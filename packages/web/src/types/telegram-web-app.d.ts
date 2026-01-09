// TypeScript declarations for Telegram Web App
// Based on https://core.telegram.org/bots/webapps

interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

interface TelegramWebAppChat {
  id: number
  type: 'group' | 'supergroup' | 'channel'
  title: string
  username?: string
  photo_url?: string
}

interface TelegramWebAppInitData {
  query_id?: string
  user?: TelegramWebAppUser
  receiver?: TelegramWebAppUser
  chat?: TelegramWebAppChat
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel'
  chat_instance?: string
  start_param?: string
  can_send_after?: number
  auth_date?: number
  hash?: string
}

interface TelegramThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  header_bg_color?: string
  bottom_bar_bg_color?: string
  accent_text_color?: string
  section_bg_color?: string
  section_header_text_color?: string
  section_separator_color?: string
  subtitle_text_color?: string
  destructive_text_color?: string
}

interface TelegramWebAppBackButton {
  isVisible: boolean
  onClick(callback: () => void): void
  offClick(callback: () => void): void
  show(): void
  hide(): void
}

interface TelegramWebAppMainButton {
  text: string
  color: string
  textColor: string
  isVisible: boolean
  isActive: boolean
  isProgressVisible: boolean
  setText(text: string): void
  onClick(callback: () => void): void
  offClick(callback: () => void): void
  show(): void
  hide(): void
  enable(): void
  disable(): void
  showProgress(leaveActive?: boolean): void
  hideProgress(): void
  setParams(params: {
    text?: string
    color?: string
    text_color?: string
    is_active?: boolean
    is_visible?: boolean
  }): void
}

interface TelegramWebAppHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
  notificationOccurred(type: 'error' | 'success' | 'warning'): void
  selectionChanged(): void
}

interface TelegramWebApp {
  /**
   * A string with raw data transferred to the Web App, convenient for validating data.
   * WARNING: Validate this data on your backend server before using it for security purposes.
   */
  initData: string

  /** An object with input data transferred to the Web App. */
  initDataUnsafe: TelegramWebAppInitData

  /** The version of the Bot API available in the user's Telegram app. */
  version: string

  /** The name of the platform of the user's Telegram app. */
  platform: string

  /** The color scheme currently used in the Telegram app. */
  colorScheme: 'light' | 'dark'

  /** An object containing the current theme settings used in the Telegram app. */
  themeParams: TelegramThemeParams

  /** True if the Web App is expanded to the maximum available height. */
  isExpanded: boolean

  /** The current height of the visible area of the Web App. */
  viewportHeight: number

  /** The height of the visible area of the Web App in its last stable state. */
  viewportStableHeight: number

  /** The current header color in the #RRGGBB format. */
  headerColor: string

  /** The current background color in the #RRGGBB format. */
  backgroundColor: string

  /** True if the confirmation dialog is enabled while the user is trying to close the Web App. */
  isClosingConfirmationEnabled: boolean

  /** An object for controlling the back button which can be displayed in the header of the Web App. */
  BackButton: TelegramWebAppBackButton

  /** An object for controlling the main button which is displayed at the bottom of the Web App. */
  MainButton: TelegramWebAppMainButton

  /** An object for controlling haptic feedback. */
  HapticFeedback: TelegramWebAppHapticFeedback

  /**
   * A method that informs the Telegram app that the Web App is ready to be displayed.
   * It is recommended to call this method as early as possible, as soon as all essential interface elements are loaded.
   */
  ready(): void

  /**
   * A method that expands the Web App to the maximum available height.
   */
  expand(): void

  /**
   * A method that closes the Web App.
   */
  close(): void

  /**
   * A method that sets the app header color in the #RRGGBB format or using one of the following keywords:
   * bg_color, secondary_bg_color
   */
  setHeaderColor(color: string): void

  /**
   * A method that sets the app background color in the #RRGGBB format or using one of the following keywords:
   * bg_color, secondary_bg_color
   */
  setBackgroundColor(color: string): void

  /**
   * A method that enables the confirmation dialog while the user is trying to close the Web App.
   */
  enableClosingConfirmation(): void

  /**
   * A method that disables the confirmation dialog while the user is trying to close the Web App.
   */
  disableClosingConfirmation(): void

  /**
   * A method that shows a native popup for scanning a QR code.
   */
  showScanQrPopup(params: { text?: string }, callback?: (text: string) => void): void

  /**
   * A method that closes the native popup for scanning a QR code.
   */
  closeScanQrPopup(): void

  /**
   * A method that shows a native popup requesting permission for the bot to send messages to the user.
   */
  requestWriteAccess(callback?: (granted: boolean) => void): void

  /**
   * A method that shows a native popup prompting the user for their phone number.
   */
  requestContact(callback?: (granted: boolean) => void): void

  /**
   * A method that shows a native popup.
   */
  showPopup(params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text?: string }> }, callback?: (buttonId: string) => void): void

  /**
   * A method that shows a native message.
   */
  showAlert(message: string, callback?: () => void): void

  /**
   * A method that shows a native confirmation dialog.
   */
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void

  /**
   * A method that opens a link in an external browser.
   */
  openLink(url: string, options?: { try_instant_view?: boolean }): void

  /**
   * A method that opens a telegram link inside the Telegram app.
   */
  openTelegramLink(url: string): void

  /**
   * A method that opens an invoice using its url.
   */
  openInvoice(url: string, callback?: (status: string) => void): void

  /**
   * A method that sends data to the bot.
   */
  sendData(data: string): void

  /**
   * A method that inserts the bot's username and the specified inline query in the current chat's input field.
   */
  switchInlineQuery(query: string, choose_chat_types?: string[]): void

  /**
   * A method that requests the opening of a link without closing the Web App.
   */
  readTextFromClipboard(callback?: (text: string) => void): void
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
}
