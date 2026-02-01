import Foundation
import ExpoModulesCore
import UnityFramework

class UnityManager: NSObject, UnityFrameworkListener {
    // Singleton para garantir apenas uma instância do Unity
    static let shared = UnityManager()
    
    var ufw: UnityFramework?
    
    private override init() {}
    
    func showUnity(in view: UIView) {
        print("🔍 [UnityManager] Iniciando processo de carga...")

        // 1. Verificação de Thread (Obrigatório ser na Main)
        if !Thread.isMainThread {
            print("⚠️ [UnityManager] Chamada fora da Main Thread. Redirecionando...")
            DispatchQueue.main.async {
                self.showUnity(in: view)
            }
            return
        }

        // 2. DIAGNÓSTICO DE ARQUIVOS
        let bundlePath = Bundle.main.bundlePath
        let dataPath = bundlePath + "/Data"
        
        if !FileManager.default.fileExists(atPath: dataPath) {
            print("❌ [UnityManager] ERRO CRÍTICO: Pasta 'Data' NÃO encontrada em: \(dataPath)")
        } else {
            print("✅ [UnityManager] Pasta 'Data' encontrada com sucesso.")
        }

        // 3. Carregar o Framework se ainda não existe
        if ufw == nil {
            print("🔄 [UnityManager] Inicializando UnityFramework...")
            let frameworkPath = bundlePath + "/Frameworks/UnityFramework.framework"
            let bundle = Bundle(path: frameworkPath)
            
            if bundle?.isLoaded == false {
                bundle?.load()
            }
            
            // Pega a instância principal do Unity
            if let frameworkClass = bundle?.principalClass as? UnityFramework.Type {
                let framework = frameworkClass.getInstance()
                if framework?.appController() == nil {
                    
                    framework?.register(self)
                    
                    // Argumentos críticos para Unity 6+
                    var argv = CommandLine.unsafeArgv
                    let argc = CommandLine.argc
                    framework?.runEmbedded(withArgc: argc, argv: argv, appLaunchOpts: nil)
                }
                self.ufw = framework
            } else {
                print("❌ [UnityManager] Falha ao obter UnityFramework.Type. O binário pode estar corrompido.")
            }
        }
        
        // 4. Anexar a View do Unity na View do React Native
        if let unityView = ufw?.appController()?.rootView {
            
            // Garante que o tamanho acompanhe a tela ANTES de checar se já existe
            unityView.frame = view.bounds
            unityView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

            if unityView.superview != view {
                print("✅ [UnityManager] Anexando View do Unity na tela...")
                view.addSubview(unityView)
            } else {
                print("ℹ️ [UnityManager] View do Unity já estava anexada. Apenas atualizando layout.")
            }
            
            // --- CORREÇÃO TELA PRETA: ACORDA O UNITY ---
            print("🚀 [UnityManager] Forçando Unity a despausar...")
            ufw?.pause(false)
            // -------------------------------------------
            
            unityView.setNeedsLayout()
            
            // Log para conferir se o tamanho não é 0x0
            print("📏 [UnityManager] Tamanho final da View Unity: \(unityView.frame)")
            
        } else {
            print("❌ [UnityManager] appController ou rootView retornaram nulo.")
        }
    }
    
    func unloadUnity() {
        ufw?.unloadApplication()
    }

    func sendMessageToUnity(objectName: String, methodName: String, message: String) {
       ufw?.sendMessageToGO(withName: objectName, functionName: methodName, message: message)
    }
    
    // MARK: - UnityFrameworkListener
    func unityDidUnload(_ notification: Notification!) {
        print("ℹ️ [UnityManager] Unity foi descarregado da memória.")
        ufw?.unregisterFrameworkListener(self)
        ufw = nil
    }
}