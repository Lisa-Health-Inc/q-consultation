import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useRef,
  useEffect,
  useState,
  ClipboardEvent,
} from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { stringifyError } from '../../utils/parse'

import { sendMessage, uploadFile, showNotification } from '../../actionCreators'
import {
  chatConnectedSelector,
  createDialogsByIdSelector,
} from '../../selectors'
import { createUseComponent, useActions } from '../../hooks'
import { QBContentUploadSuccessAction } from '../../actions'
import { formatFileSize, isFileExtensionValid } from '../../utils/file'
import { createMapStateSelector } from '../../utils/selectors'
import IS_MOBILE from '../../utils/isMobile'

export interface ChatInputProps {
  dialogId?: QBChatDialog['_id']
  clientId?: QBUser['id']
}

const createSelector = (dialogId?: QBChatDialog['_id']) =>
  createMapStateSelector({
    connected: chatConnectedSelector,
    currentDialog: createDialogsByIdSelector(dialogId),
  })

export default createUseComponent((props: ChatInputProps) => {
  const { dialogId, clientId } = props
  const selector = createSelector(dialogId)
  const store = useSelector(selector)
  const actions = useActions({
    sendMessage,
    uploadFile,
    showNotification,
  })
  const { t } = useTranslation()
  const { connected, currentDialog } = store
  const texboxRef = useRef<HTMLDivElement>(null)
  const [messageBody, setMessageBody] = useState<string | null>(null)

  const disableControls = !currentDialog?.joined || !connected

  const submitMessage = (attachment?: ChatMessageAttachment) => {
    if (dialogId && (messageBody?.trim().length || attachment)) {
      const message: QBChatNewMessage = {
        type: 'groupchat',
        body: messageBody?.trim() || '',
        extension: {
          save_to_history: 1,
          dialog_id: dialogId,
        },
        markable: 1,
      }

      if (attachment) {
        message.extension.attachments = [attachment]
      }
      actions.sendMessage({
        dialogId: QB.chat.helpers.getRoomJidFromDialogId(dialogId),
        message,
      })
      setMessageBody('')

      if (texboxRef.current) {
        texboxRef.current.innerText = ''
      }

      if (clientId) {
        const sendPush = () =>
          QB.chat.message.list(
            {
              chat_dialog_id: dialogId,
              sort_desc: 'date_sent',
              limit: 50,
              skip: 0,
              mark_as_read: 0,
            },
            (err, messages) => {
              let badge = 1

              if (err) {
                console.log('Get messages error', stringifyError(err))
              } else {
                badge += messages.items.filter(
                  (msg) => !!msg.read_ids && !msg.read_ids.includes(clientId),
                ).length

                console.log(`Badge count ${badge}`)
              }

              const payload = JSON.stringify({
                aps: {
                  alert: {
                    title: 'You got a new message from the coach',
                    body: messageBody?.trim() || 'New attachment',
                  },
                  badge,
                  name: 'chat',
                },
              })

              const pushParameters: PushNotificationParams = {
                notification_type: 'push',
                push_type: 'apns',
                user: { ids: [clientId] },
                environment:
                  process.env.NODE_ENV === 'development'
                    ? 'development'
                    : 'production',
                message: `payload=${QB.pushnotifications.base64Encode(
                  payload,
                )}`,
                name: 'chat',
              }

              QB.pushnotifications.events.create(
                pushParameters,
                (error, result) => {
                  if (error) {
                    console.log(stringifyError(error))
                  } else {
                    console.log('Push Notification is sent.', result)
                  }
                },
              )
            },
          )

        try {
          QB.chat.muc.listOnlineUsers(
            QB.chat.helpers.getRoomJidFromDialogId(dialogId),
            (users) => {
              if (!users.includes(clientId)) {
                sendPush()
                console.log('Push sent: recipient is offline')
              } else {
                console.log('Skip push: recipient is online')
              }
            },
          )
        } catch (error: unknown) {
          sendPush()
          console.log('listOnlineUsers error', stringifyError(error))
        }
      }
    }
  }

  const handleChangeMessage = ({
    currentTarget,
  }: FormEvent<HTMLDivElement>) => {
    setMessageBody(currentTarget.outerText)
  }

  const handleSendMessage = () => submitMessage()

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')

    const range = document.getSelection()?.getRangeAt(0)

    if (range) {
      range.deleteContents()

      const textNode = document.createTextNode(text)

      range.insertNode(textNode)
      range.selectNodeContents(textNode)
      range.collapse(false)

      const selection = window.getSelection()

      selection?.removeAllRanges()
      selection?.addRange(range)

      if (texboxRef.current?.innerText) {
        setMessageBody(texboxRef.current?.innerText)
      }
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (IS_MOBILE) return

    if (texboxRef.current && event.key === 'Enter') {
      event.preventDefault()

      if (event.altKey || event.ctrlKey || event.shiftKey) {
        document.execCommand('insertLineBreak')
      } else {
        submitMessage()
      }
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.item(0)

    if (!file) return

    if (!isFileExtensionValid(file.name)) {
      actions.showNotification({
        duration: 3 * SECOND,
        id: Date.now().toString(),
        position: 'bottom-center',
        type: 'error',
        message: t('INVALID_FILE', {
          extensions: FILE_EXTENSIONS_WHITELIST.split(' ').join(', '),
        }),
      })
    } else if (file.size > FILE_SIZE_LIMIT) {
      actions.showNotification({
        duration: 3 * SECOND,
        id: Date.now().toString(),
        position: 'bottom-center',
        type: 'error',
        message: t('FILE_SIZE_LIMIT', {
          size: formatFileSize(FILE_SIZE_LIMIT),
        }),
      })
    } else {
      actions.uploadFile(
        file,
        'chat',
        (action: QBContentUploadSuccessAction) => {
          const { id, name, size, uid, content_type } = action.payload
          const type = content_type.replace(/(\/.*)$/, '')

          submitMessage({ id, name, size, type, uid })
        },
      )
    }
    e.target.value = ''
  }

  const handleInputFocus = () => {
    // TODO: Workaround. Remove after Safari fixes the height of the workspace with the keyboard active.
    setTimeout(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      })
    }, 150)
  }

  useEffect(() => {
    setMessageBody('')

    if (texboxRef.current) {
      texboxRef.current.innerText = ''
    }
  }, [dialogId])

  return {
    store,
    actions,
    refs: { texboxRef },
    data: { disableControls, messageBody },
    handlers: {
      handleChangeMessage,
      handleSendMessage,
      handleKeyDown,
      handlePaste,
      handleFileChange,
      handleInputFocus,
    },
  }
})
