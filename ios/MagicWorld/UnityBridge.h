#import <Foundation/Foundation.h>
#import <UnityFramework/UnityFramework.h>

@interface UnityBridge : NSObject
+ (instancetype)getInstance;
- (void)showUnityView;
- (UnityFramework*)loadUnity;
@end