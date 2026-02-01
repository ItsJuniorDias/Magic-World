import ExpoModulesCore

public class UnityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Unity")

    View(UnityView.self) {
      Events("onLoad")

      // Conecta a prop do React com a função nativa
      Prop("url") { (view: UnityView, url: String) in
        view.loadUrl(url)
      }
    }
  }
}