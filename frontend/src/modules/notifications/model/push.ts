import { api } from "@/shared/api/client";

const storageKey = "buildease-push-subscription";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function base64UrlToBytes(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  const text = String.fromCharCode(...new Uint8Array(buffer));
  return btoa(text)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export const pushApi = {
  configuration: () =>
    api<{ publicKey: string }>("/notifications/push/configuration"),
  register: (body: {
    endpoint: string;
    publicKey: string;
    authSecret: string;
    expiresAt?: string;
  }) => api<{ id: string }>("/notifications/push/subscriptions", "POST", body),
  remove: (id: string) =>
    api(`/notifications/push/subscriptions/${id}`, "DELETE"),
};

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission, subscribes this browser and registers it with the backend. */
export async function enablePush() {
  if (!pushSupported())
    throw new Error("This browser does not support notifications");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Notifications are blocked for this site");
  const { publicKey } = await pushApi.configuration();
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(publicKey),
  });
  const { id } = await pushApi.register({
    endpoint: subscription.endpoint,
    publicKey: bytesToBase64Url(subscription.getKey("p256dh")),
    authSecret: bytesToBase64Url(subscription.getKey("auth")),
    expiresAt: subscription.expirationTime
      ? new Date(subscription.expirationTime).toISOString()
      : undefined,
  });
  try {
    localStorage.setItem(storageKey, id);
  } catch {
    // Storage can be unavailable (private mode); the browser subscription still works.
  }
}

export async function disablePush() {
  const subscription = await currentPushSubscription();
  await subscription?.unsubscribe();
  const id = readStoredId();
  if (id) await pushApi.remove(id);
}

function readStoredId() {
  try {
    const id = localStorage.getItem(storageKey);
    localStorage.removeItem(storageKey);
    return id;
  } catch {
    return null;
  }
}
