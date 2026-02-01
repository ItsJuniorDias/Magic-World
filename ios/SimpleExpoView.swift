import ExpoModulesCore
import UIKit

public class HelloNativeView: ExpoView {

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    let label = UILabel()
    label.text = "Hello World from Native iOS 🚀"
    label.textAlignment = .center
    label.font = UIFont.systemFont(ofSize: 22, weight: .bold)

    label.translatesAutoresizingMaskIntoConstraints = false
    addSubview(label)

    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: centerXAnchor),
      label.centerYAnchor.constraint(equalTo: centerYAnchor)
    ])
  }
}

