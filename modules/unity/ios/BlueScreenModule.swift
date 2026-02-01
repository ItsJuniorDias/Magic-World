@objc(UnityViewManager)
class UnityViewManager: RCTViewManager {

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func view() -> UIView! {
    return UnityView()
  }

  @objc override static func moduleName() -> String! {
    return "UnityView"
  }
}
