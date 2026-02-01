import ExpoModulesCore
import UIKit

class UnityView: ExpoView {
    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        self.backgroundColor = .black
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // 1. Chama o Unity para renderizar nesta View
        UnityManager.shared.showUnity(in: self)
    }

    // 👇 AQUI ESTAVA FALTANDO ESSA FUNÇÃO
    // O UnityModule.swift chama isso quando você passa a prop 'url' no React
    func loadUrl(_ url: String) {
        print("React Native enviou URL para Unity: \(url)")
        
        // Se você quiser mandar essa mensagem para dentro do Jogo Unity:
        // UnityManager.shared.sendMessageToUnity(objectName: "GameController", methodName: "SetUrl", message: url)
    }
}