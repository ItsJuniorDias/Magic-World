import { registerWebModule, NativeModule } from 'expo';

import { UnityModuleEvents } from './Unity.types';

class UnityModule extends NativeModule<UnityModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(UnityModule, 'UnityModule');
