import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
// @ts-ignore
import RNAndroidLocationEnabler from 'react-native-android-location-enabler';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Robustly requests location permission, prompts the user to enable high-accuracy GPS settings,
 * and fetches the current coordinates.
 * 
 * If a high-accuracy (GPS) lock fails or times out (e.g. indoors), it automatically falls back
 * to a network-based low-accuracy lookup, which is fast and extremely reliable indoors.
 */
export const getCurrentCoordinates = (): Promise<Coordinates> => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Check & Request Permissions on Android
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (!hasPermission) {
          const status = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (status !== PermissionsAndroid.RESULTS.GRANTED) {
            return reject(new Error('Location permission denied'));
          }
        }

        // 2. Prompt user to enable High Accuracy Location Services / GPS if needed
        try {
          const response = await RNAndroidLocationEnabler.promptForEnableLocationIfNeeded({
            interval: 10000,
            fastInterval: 5000,
          });
          console.log('GPS Location Enabler prompt response:', response);
        } catch (err) {
          // If the user cancels the prompt, we still try fetching position,
          // because the user's manual settings or fallback network provider may still work.
          console.warn('GPS Location Enabler prompt was declined or failed:', err);
        }
      }

      // 3. Try to get position with High Accuracy (GPS)
      console.log('Attempting location with High Accuracy (enableHighAccuracy: true)...');
      Geolocation.getCurrentPosition(
        (position) => {
          console.log('Successfully fetched location with High Accuracy:', position.coords);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (highAccuracyError) => {
          console.warn('High accuracy location attempt failed/timed out:', highAccuracyError);
          
          // 4. Fallback to Low Accuracy (Network provider - WiFi / cell towers)
          console.log('Falling back to Low Accuracy (enableHighAccuracy: false)...');
          Geolocation.getCurrentPosition(
            (fallbackPosition) => {
              console.log('Successfully fetched location with Low Accuracy fallback:', fallbackPosition.coords);
              resolve({
                latitude: fallbackPosition.coords.latitude,
                longitude: fallbackPosition.coords.longitude,
              });
            },
            (fallbackError) => {
              console.error('All location attempts failed:', fallbackError);
              reject(new Error('Could not get your current location. Please verify your GPS is active or connect to a network.'));
            },
            {
              enableHighAccuracy: false,
              timeout: 12000, // 12 seconds timeout for fallback
              maximumAge: 10000,
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 8000, // 8 seconds timeout for high-accuracy GPS (fast fallback)
          maximumAge: 10000,
        }
      );
    } catch (e: any) {
      console.error('Error in location utility:', e);
      reject(e);
    }
  });
};
