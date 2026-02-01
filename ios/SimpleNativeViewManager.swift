//
//  SimpleNativeViewManager.swift
//  MagicWorld
//
//  Created by Alexandre Junior on 31/01/26.
//

import Foundation
import React
import UIKit

@objc(SimpleNativeViewManager)
class SimpleNativeViewManager: RCTViewManager {

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func view() -> UIView! {

    let view = UIView()
    view.backgroundColor = .red

    return view
  }
}
