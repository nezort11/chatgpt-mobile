import Constants from "expo-constants";
import { throttle, noop } from "lodash";
import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  PanResponderInstance,
  Button,
  BackHandler,
  StatusBar,
  Keyboard,
  ScrollView,
  TextInput,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { setBackgroundColorAsync } from "expo-navigation-bar";

enum WebViewMessageType {
  GetIsDrawerOpen,
  SyncTheme,
  DismissKeyboard,
}

type MessageData = {
  type: WebViewMessageType;
  value: any;
};

const injectedCss = /* css */ `
  html {
    font-size: 1.1rem;
  }

  #__next > div > div > div:first-of-type {
    padding-top: calc(${StatusBar.currentHeight}px + 10px);
  }
  div[data-headlessui-state="open"] nav {
    padding-top: calc(${StatusBar.currentHeight}px + 10px);
  }
  div[data-headlessui-state="open"] button {
    margin-top: 27px;
  }

  main > div:last-of-type > div:last-of-type {
    display: none;
  }

  main > div:last-of-type > form {
    margin-bottom: 0.5rem;
  }
  main > div:last-of-type textarea {
    font-size: 18px;
  }
`;

const setStyleInnerHtml = /* javascript */ `
  style.innerHTML = \`${injectedCss}\`;
`;

const cssScript = /* javascript */ `
  var style = document.createElement('style');
  ${setStyleInnerHtml}
  document.head.appendChild(style);
`;

const storageChangeHandlerScript = /* javascript */ `
  var oldStorageSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (key === 'theme') {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: ${WebViewMessageType.SyncTheme},
          value: value
        }),
      );
    }
    oldStorageSetItem.apply(this, arguments);
  }
`;

const hrefChangeHandlerScript = /* javascript */ `
  var oldHref = document.location.href;
  var body = document.querySelector("body");
  var observer = new MutationObserver((mutations) => {
    var currentHref = document.location.href;
    mutations.forEach(() => {
      if (oldHref !== currentHref) {
        var url = new URL(currentHref);

        // If chat page
        if (url.pathname !== '/chat') {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: ${WebViewMessageType.DismissKeyboard} }),
          );
        }

        oldHref = currentHref;
      }
    });
  });
  // Listen to DOM changes
  observer.observe(body, { childList: true, subtree: true });
`;

const mainScript = /* javascript */ `
  ${cssScript}

  ${storageChangeHandlerScript}

  ${hrefChangeHandlerScript}

  // Sync theme on init
  window.ReactNativeWebView.postMessage(
    JSON.stringify({
      type: ${WebViewMessageType.SyncTheme},
      value: localStorage.getItem('theme') || light,
    }),
  );
`;

// var newChatPlusButton = document.querySelector(
//   "#__next div div div:first-of-type button:last-of-type"
// );
// newChatPlusButton.addEventListener("click", () => {
//   var textArea = document.querySelector("main textarea");
//   // textArea.focus();
//   // textArea.blur();
//   window.ReactNativeWebView.postMessage(
//     JSON.stringify({ type: ${WebViewMessageType.DismissKeyboard} }),
//   );
// });

const erudaScript = /* javascript */ `
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  document.body.appendChild(script);
  script.onload = () => {
    try {
      eruda.init();

      ${mainScript}
    } catch (error) {
      console.error(error);
    }
  }
`;

const injectedScript = /* javascript */ `
  // alert('hi')
  try {
    window.addEventListener('load', () => {
      try {
        ${__DEV__ ? erudaScript : mainScript}
      } catch (error) {
        console.error(error);
      }
    });
  } catch (error) {
    console.error(error);
  }
`;

const COLOR_LIGHT = "white";
const COLOR_DARK = "rgb(52, 53, 65)";

const App: React.FC = () => {
  const webviewRef = useRef<null | WebView>(null);
  const textInputRef = useRef<null | TextInput>(null);
  const messageHandler = useRef<((data: MessageData) => void) | null>(null);
  const [displayTextField, setDisplayTextField] = useState(true);

  const dismissKeyboard = useCallback(() => {
    textInputRef.current?.focus();
    textInputRef.current?.blur();
  }, []);

  const handleOpenDrawler = () => {
    // console.log("open drawer");
    webviewRef.current?.injectJavaScript(/* javascript */ `
      try {
        // console.log('left to right');
        var isDrawerOpen = !!document.querySelector('div[data-headlessui-state="open"]');
        // console.log('Drawer is open: ', isDrawerOpen);

        if (!isDrawerOpen) {
          var drawerButton = document.querySelector('button');
          // console.log('Drawer button: ', drawerButton);
          drawerButton.click();
        }
      } catch (error) {
        console.error(error);
      }
    `);
  };

  const handleCloseDrawler = useCallback(() => {
    webviewRef.current?.injectJavaScript(/* javascript */ `
      try {
        // console.log('right to left');
        var isDrawerOpen = !!document.querySelector('div[data-headlessui-state="open"]');
        // console.log('Drawer is open: ', isDrawerOpen);

        if (isDrawerOpen) {
          var drawerButton = document.querySelector('button');
          // console.log('Drawer button: ', drawerButton);
          drawerButton.click();
        }
      } catch (error) {
        console.error(error);
      }
  `);
  }, []);

  const handleLeftToRightSwipe = useRef(
    throttle(
      () => {
        // console.log("Throttled left-to-right gesture event");
        handleOpenDrawler();
        // }
      },
      500,
      {
        trailing: false,
      }
    )
  ).current;

  const handleRightToLeftSwipe = useRef(
    throttle(
      () => {
        // console.log("Throttled right-to-left gesture event");
        handleCloseDrawler();
      },
      500,
      {
        trailing: false,
      }
    )
  ).current;

  const checkIsOpen = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      messageHandler.current = (data: MessageData) => {
        // console.log("i got message: ", event.nativeEvent.data);
        resolve(data.value);
      };

      webviewRef.current?.injectJavaScript(/* javascript */ `
        var isDrawerOpen = !!document.querySelector('div[data-headlessui-state="open"]');
        // console.log("DRAWER", isDrawerOpen);
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: ${WebViewMessageType.GetIsDrawerOpen}, value: isDrawerOpen }),
        );
      `);

      setTimeout(() => resolve(false), 10000);
    });
  };

  const handleBackButtonAsync = async () => {
    // console.log("back button was pressed");
    const isDrawerOpen = await checkIsOpen();
    // console.log("Drawer is currently: ", isDrawerOpen);

    if (isDrawerOpen) {
      handleCloseDrawler();
    } else {
      BackHandler.exitApp();
    }
  };

  const handleBackButton = () => {
    // console.log("handleBackButton");
    handleBackButtonAsync();
    // console.log("something have happended");
    return true;
  };

  useEffect(() => {
    BackHandler.addEventListener("hardwareBackPress", handleBackButton);

    return () =>
      BackHandler.removeEventListener("hardwareBackPress", handleBackButton);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        Math.abs(gestureState.dx) > 50,
      onPanResponderMove: (_event, gestureState) => {
        // console.log("onPanResponderMove was called");
        // console.log("on pan responder move");
        if (gestureState.dx > 0) {
          // The user made a left-to-right swipe
          // Throttle the callback to be called once every 2 seconds
          // console.log("User made left-to-right gesture");
          handleLeftToRightSwipe();
        }
        if (gestureState.dx < 0) {
          // The user made a left-to-right swipe
          // Throttle the callback to be called once every 2 seconds
          // console.log("User made -to-right gesture");
          handleRightToLeftSwipe();
        }
      },
    })
  ).current;

  const handleSyncTheme = async (data: MessageData) => {
    try {
      await setBackgroundColorAsync(
        data.value === "light" ? COLOR_LIGHT : COLOR_DARK
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    const data: MessageData = JSON.parse(event.nativeEvent.data);

    if (data.type === WebViewMessageType.SyncTheme) {
      handleSyncTheme(data);
      return;
    }

    if (data.type === WebViewMessageType.DismissKeyboard) {
      dismissKeyboard();
      return;
    }

    if (data.type === WebViewMessageType.GetIsDrawerOpen) {
      messageHandler.current?.(data);
    }
  };

  const handleWebViewLoaded = useCallback(() => {
    webviewRef.current?.requestFocus();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "white",
      }}
      {...panResponder.panHandlers}
    >
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent={true}
      />
      <WebView
        ref={webviewRef}
        source={{ uri: "https://chat.openai.com/chat" }}
        originWhitelist={["*"]}
        domStorageEnabled
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        onMessage={handleMessage}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        keyboardDisplayRequiresUserAction={false}
        onLoad={handleWebViewLoaded}
        // bounces={false}
        overScrollMode="never"
        // allowFileAccess
        // allowFileAccessFromFileURLs
      />
      <TextInput ref={textInputRef} autoFocus style={{ display: "none" }} />
    </View>
  );
};

export default App;
