import { FirebaseAppConfig } from '@angular/fire';

export interface IConfig {
  firebaseConfig: FirebaseAppConfig;
  functionsUrl: string;
  editorUrl: string;
  termsAndConditionsUrl: string;
  privacyUrl: string;
  hightlighJsURL: string;
  hightlighCSSURL: string;
  katexCSSURL: string;
  addressByLatLongURL: string;
  addressSuggestionsURL: string;
}
