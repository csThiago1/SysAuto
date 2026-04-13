/**
 * Minimal type stub for expo-notifications until the package is installed.
 * Run: npx expo install expo-notifications
 */
declare module 'expo-notifications' {
  export type AndroidImportance = number;
  export const AndroidImportance: {
    MAX: AndroidImportance;
    HIGH: AndroidImportance;
    DEFAULT: AndroidImportance;
    LOW: AndroidImportance;
    NONE: AndroidImportance;
  };

  export interface NotificationContent {
    title: string | null;
    body: string | null;
    data: Record<string, unknown>;
  }

  export interface NotificationRequest {
    identifier: string;
    content: NotificationContent;
    trigger: unknown;
  }

  export interface Notification {
    date: number;
    request: NotificationRequest;
  }

  export interface EventSubscription {
    remove: () => void;
  }

  export interface PermissionStatus {
    status: 'granted' | 'denied' | 'undetermined';
  }

  export interface ExpoPushToken {
    type: string;
    data: string;
  }

  export interface NotificationBehavior {
    shouldShowAlert: boolean;
    shouldPlaySound: boolean;
    shouldSetBadge: boolean;
    shouldShowBanner?: boolean;
    shouldShowList?: boolean;
  }

  export interface NotificationChannel {
    name: string;
    importance?: AndroidImportance;
    vibrationPattern?: number[];
    lightColor?: string;
  }

  export function setNotificationHandler(handler: {
    handleNotification: (notification: Notification) => Promise<NotificationBehavior>;
  }): void;

  export function getPermissionsAsync(): Promise<PermissionStatus>;
  export function requestPermissionsAsync(): Promise<PermissionStatus>;
  export function getExpoPushTokenAsync(): Promise<ExpoPushToken>;
  export function setNotificationChannelAsync(id: string, channel: NotificationChannel): Promise<void>;
  export function addNotificationReceivedListener(
    listener: (notification: Notification) => void,
  ): EventSubscription;
}
