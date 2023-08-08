import { useTranslation } from 'react-i18next'

import ChatHeader from '../../components/ChatHeader'
import AppointmentInfo from '../AppointmentInfo'
import ChatMessages from '../ChatMessages'
import UploadIndicator from '../UploadIndicator'
import ChatInput from '../ChatInput'
import Tabs from '../../components/Tabs'
import VideoCall from '../VideoCall'
import ChatHistoryTab from '../ChatHistoryTab'
import useComponent, { ChatProps } from './useComponent'
import './styles.css'
import {
  ABOUT_TAB,
  CALL_TAB,
  CHAT_TAB,
  HISTORY_TAB,
} from '../../constants/tabs'

export default function Chat(props: ChatProps) {
  const {
    store: {
      users,
      records,
      call,
      currentDialog,
      myAccount,
      connected,
      usersLoading,
    },
    actions: { updateAppointment, startCall },
    refs: { callTabRef },
    data: {
      dialogName,
      activeAppointment,
      RESOLUTION_XS,
      activeTab,
      companion,
      isOffline,
    },
    handlers: { setActiveTab },
  } = useComponent(props)
  const { t } = useTranslation()

  return (
    <div className="chat-container">
      <ChatHeader
        connected={connected}
        appointment={activeAppointment}
        myAccount={myAccount}
        companion={companion}
        dialogName={currentDialog ? dialogName : '\u00A0'}
        session={call}
        startCall={startCall}
        updateAppointment={updateAppointment}
        loading={usersLoading && !companion}
      />
      <main>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.Tab name={ABOUT_TAB} title={t('About')}>
            <AppointmentInfo
              records={records}
              appointment={activeAppointment}
              user={
                activeAppointment
                  ? users[activeAppointment.client_id]
                  : undefined
              }
            />
          </Tabs.Tab>
          <Tabs.Tab name={CHAT_TAB} title={t('Chat')} disabled={isOffline}>
            <ChatMessages
              dialogId={activeAppointment?.dialog_id}
              chatOpen={activeTab === CHAT_TAB}
            />
            <UploadIndicator type="chat" />
            <ChatInput
              dialogId={activeAppointment?.dialog_id}
              clientId={activeAppointment?.client_id}
            />
          </Tabs.Tab>
          {RESOLUTION_XS && (
            <Tabs.Tab
              name={CALL_TAB}
              title={t('Call')}
              className="call"
              ref={callTabRef}
              disabled={isOffline}
            >
              <VideoCall dialogName={dialogName} />
            </Tabs.Tab>
          )}
          <Tabs.Tab
            name={HISTORY_TAB}
            title={t('History')}
            disabled={isOffline}
          >
            {activeTab === HISTORY_TAB && (
              <ChatHistoryTab clientId={activeAppointment?.client_id} />
            )}
          </Tabs.Tab>
        </Tabs>
      </main>
    </div>
  )
}
