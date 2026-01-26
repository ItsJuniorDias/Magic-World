import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

//  import * as Device from "expo-device";


export async function registerForPushNotifications() {
  // if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  console.log(finalStatus, "FINAL STATUS");

  
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  console.log(
  "PROJECT ID:",
  Constants.expoConfig?.extra?.eas?.projectId
);

  try {
   const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

   return tokenData.data;
  }catch (error) {  
    console.error("Error registering for push notifications:", error);
  }

 
}
