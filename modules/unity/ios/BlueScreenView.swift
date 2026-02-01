import ExpoModulesCore
import UIKit

class BlueScreenView: ExpoView {
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    
    // Configuração da View nativa
    self.backgroundColor = UIColor.blue
    
    // Na arquitetura antiga, o layout é calculado pela Yoga (shadow thread)
    // e aplicado na Main Thread. O ExpoView lida com isso.
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}