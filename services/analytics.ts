import * as Analytics from "expo-firebase-analytics";

export const logEvent = async (
  eventName: string,
  params?: Record<string, any>
) => {
  try {
    await Analytics.logEvent(eventName, params);
  } catch (e) {
    console.log("Analytics error", e);
  }
};