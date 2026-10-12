/**
 * DEFAULT_NOTIFICATION_CONFIG — multi-channel notification settings.
 *
 * Three channels: Email, Message (SMS) and App (push). Each channel has an
 * enable flag, provider/sender configuration and a set of per-event toggles
 * that decide which business events fire on that channel. Mutable singleton so
 * the Notification Settings screen edits it and senders read it within a session.
 */
export interface NotificationChannel {
  enabled: boolean;
  fields: Record<string, string>;
  events: Record<string, boolean>;
}
export interface NotificationConfigData {
  email: NotificationChannel;
  sms: NotificationChannel;
  whatsapp: NotificationChannel;
  app: NotificationChannel;
}

/** Business events any channel can subscribe to (shared catalogue). */
export const NOTIFICATION_EVENTS: { key: string; label: string; desc: string }[] = [
  { key: "invoice", label: "Invoice / Bill", desc: "Send the bill when a sale is completed." },
  { key: "payment", label: "Payment Receipt", desc: "Acknowledge a customer collection / payment." },
  { key: "order", label: "Order Confirmation", desc: "Confirm a sales order / quotation." },
  { key: "delivery", label: "Delivery Update", desc: "Dispatch & delivery status to the customer." },
  { key: "outstanding", label: "Payment Reminder", desc: "Remind customers of outstanding dues." },
  { key: "loyalty", label: "Loyalty & Rewards", desc: "Points earned, redeemed & tier upgrades." },
  { key: "offers", label: "Offers & Campaigns", desc: "Promotional offers, festival & birthday wishes." },
  { key: "lowStock", label: "Low Stock Alert", desc: "Internal alert when stock hits reorder level." },
  { key: "approval", label: "Approval Request", desc: "Internal alert for pending approvals." },
];

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfigData = {
  email: {
    enabled: true,
    fields: {
      provider: "smtp", // smtp | sendgrid | ses | mailgun
      fromName: "One ERP Retail",
      fromEmail: "billing@onepos.in",
      replyTo: "support@onepos.in",
      smtpHost: "smtp.onepos.in",
      smtpPort: "587",
      encryption: "tls", // none | ssl | tls
    },
    events: { invoice: true, payment: true, order: true, delivery: true, outstanding: true, loyalty: false, offers: true, lowStock: true, approval: true },
  },
  sms: {
    enabled: true,
    fields: {
      provider: "msg91", // msg91 | twilio | textlocal | gupshup
      senderId: "ONEPOS",
      route: "transactional", // transactional | promotional
      dltEntityId: "",
      apiKey: "",
    },
    events: { invoice: true, payment: true, order: true, delivery: true, outstanding: true, loyalty: true, offers: false, lowStock: false, approval: false },
  },
  whatsapp: {
    enabled: false,
    fields: {
      provider: "gupshup", // gupshup | twilio | wati | meta
      businessNumber: "",
      wabaId: "",
      apiKey: "",
    },
    events: { invoice: true, payment: true, order: true, delivery: true, outstanding: true, loyalty: true, offers: true, lowStock: false, approval: false },
  },
  app: {
    enabled: true,
    fields: {
      provider: "fcm", // fcm | onesignal | apns
      appName: "One ERP",
      serverKey: "",
      sound: "default",
    },
    events: { invoice: false, payment: true, order: true, delivery: true, outstanding: true, loyalty: true, offers: true, lowStock: true, approval: true },
  },
};

export const CHANNEL_META: Record<keyof NotificationConfigData, { label: string; desc: string }> = {
  email: { label: "E-Mail", desc: "Transactional & promotional emails to customers and staff." },
  sms: { label: "Message (SMS)", desc: "DLT-compliant transactional & promotional SMS." },
  whatsapp: { label: "WhatsApp", desc: "WhatsApp Business messages — invoices, reminders & offers." },
  app: { label: "App (Push)", desc: "Mobile / web push notifications via the customer & staff app." },
};

/** Provider / config field definitions per channel for the editor. */
export const CHANNEL_FIELDS: Record<keyof NotificationConfigData, { key: string; label: string; type?: "text" | "password"; options?: { value: string; label: string }[]; placeholder?: string }[]> = {
  email: [
    { key: "provider", label: "Provider", options: [{ value: "smtp", label: "SMTP" }, { value: "sendgrid", label: "SendGrid" }, { value: "ses", label: "Amazon SES" }, { value: "mailgun", label: "Mailgun" }] },
    { key: "fromName", label: "From Name", placeholder: "One ERP Retail" },
    { key: "fromEmail", label: "From Email", placeholder: "billing@company.com" },
    { key: "replyTo", label: "Reply-To Email", placeholder: "support@company.com" },
    { key: "smtpHost", label: "SMTP Host", placeholder: "smtp.company.com" },
    { key: "smtpPort", label: "SMTP Port", placeholder: "587" },
    { key: "encryption", label: "Encryption", options: [{ value: "none", label: "None" }, { value: "ssl", label: "SSL" }, { value: "tls", label: "TLS" }] },
  ],
  sms: [
    { key: "provider", label: "Provider", options: [{ value: "msg91", label: "MSG91" }, { value: "twilio", label: "Twilio" }, { value: "textlocal", label: "Textlocal" }, { value: "gupshup", label: "Gupshup" }] },
    { key: "senderId", label: "Sender ID", placeholder: "ONEPOS" },
    { key: "route", label: "Route", options: [{ value: "transactional", label: "Transactional" }, { value: "promotional", label: "Promotional" }] },
    { key: "dltEntityId", label: "DLT Entity ID", placeholder: "11000xxxxxxxxx" },
    { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••" },
  ],
  whatsapp: [
    { key: "provider", label: "Provider", options: [{ value: "gupshup", label: "Gupshup" }, { value: "twilio", label: "Twilio" }, { value: "wati", label: "WATI" }, { value: "meta", label: "Meta Cloud API" }] },
    { key: "businessNumber", label: "Business Number", placeholder: "+91 90000 00000" },
    { key: "wabaId", label: "WABA ID", placeholder: "WhatsApp Business Account ID" },
    { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••" },
  ],
  app: [
    { key: "provider", label: "Provider", options: [{ value: "fcm", label: "Firebase (FCM)" }, { value: "onesignal", label: "OneSignal" }, { value: "apns", label: "Apple (APNs)" }] },
    { key: "appName", label: "App Name", placeholder: "One ERP" },
    { key: "serverKey", label: "Server / API Key", type: "password", placeholder: "••••••••" },
    { key: "sound", label: "Notification Sound", placeholder: "default" },
  ],
};

/** Deep clone so the editor never mutates the shared default. */
export function cloneNotificationConfig(): NotificationConfigData {
  return JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_CONFIG));
}

/* ---------- read helpers senders use ---------- */
export const channelOn = (ch: keyof NotificationConfigData) => !!DEFAULT_NOTIFICATION_CONFIG[ch].enabled;
export const notifyOn = (ch: keyof NotificationConfigData, event: string) =>
  !!DEFAULT_NOTIFICATION_CONFIG[ch].enabled && !!DEFAULT_NOTIFICATION_CONFIG[ch].events[event];

export function applyNotificationConfig(next: NotificationConfigData) {
  (Object.keys(next) as (keyof NotificationConfigData)[]).forEach((ch) => {
    DEFAULT_NOTIFICATION_CONFIG[ch] = JSON.parse(JSON.stringify(next[ch]));
  });
}
