// ios/UnityViewManager.m

#import <React/RCTViewManager.h>
#import <UnityFramework/UnityFramework.h> // Importar o framework do Unity

// Interface que define que esta classe gerencia Views
@interface UnityViewManager : RCTViewManager
@end

@implementation UnityViewManager

// 1. MACRO CRUCIAL: Isso exporta o módulo com o nome "UnityView" para o JS
RCT_EXPORT_MODULE(UnityView)

// 2. Método que retorna a View que será desenhada na tela
- (UIView *)view
{
  // AQUI é onde a mágica do Unity vai acontecer.
  // Por enquanto, vamos retornar uma View vermelha para checar se o erro sumiu.
  UIView *view = [[UIView alloc] init];
  [view setBackgroundColor:[UIColor redColor]];
  
  // Lógica futura: [UnityBridge.getInstance setUnityViewTo:view];
  
  return view;
}

@end