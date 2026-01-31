import ExpoModulesCore

public class HelloNativeViewModule: Module {

  public func definition() -> ModuleDefinition {

    Name("HelloNativeView")

    OnCreate {
      print("🔥 HELLO MODULE CARREGADO")
    }

    View(HelloNativeView.self) {
    }
  }
}

