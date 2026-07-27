// Must be the very first import — react-navigation's drawer relies on
// react-native-gesture-handler, which requires this side-effect import at the
// top of the entry file (before anything else loads).
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
