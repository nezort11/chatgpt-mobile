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
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

// console.log("Hello, world");

const injectedCss = /* css */ `
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

const erudaScript = /* javascript */ `
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  document.body.appendChild(script);
  script.onload = () => {
    try {
      eruda.init();
    } catch (error) {
      console.error(error);
    }
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

const injectedScript = /* javascript */ `
  try {
    window.addEventListener('load', () => {
      try {
        ${__DEV__ ? erudaScript : ""}

        window.ReactNativeWebView.postMessage('Hello, world');

        ${cssScript}
      } catch (error) {
        console.error(error);
      }
    });
  } catch (error) {
    console.error(error);
  }
`;

const App: React.FC = () => {
  const webviewRef = useRef<null | WebView>(null);
  const messageHandler = useRef<((event: WebViewMessageEvent) => void) | null>(
    null
  );

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
        // if (!drawerIsOpen) {
        // handleOpenChatGptDrawer();
        // handleOpenDrawler();
        handleOpenDrawler();
        // webviewRef.current?.injectJavaScript(
        //   `document.querySelector('button').click();`
        // );
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
        // if (!drawerIsOpen) {
        // handleOpenChatGptDrawer();
        handleCloseDrawler();
        // }
      },
      500,
      {
        trailing: false,
      }
    )
  ).current;

  const checkIsOpen = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      messageHandler.current = (event: WebViewMessageEvent) => {
        // console.log("i got message: ", event.nativeEvent.data);
        resolve(event.nativeEvent.data === "true");
      };

      webviewRef.current?.injectJavaScript(/* javascript */ `
        var isDrawerOpen = !!document.querySelector('div[data-headlessui-state="open"]');
        // console.log("DRAWER", isDrawerOpen);
        window.ReactNativeWebView.postMessage(isDrawerOpen.toString());
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
          // if (!drawerIsOpen.current) {
          handleLeftToRightSwipe();
          // }
        }
        if (gestureState.dx < 0) {
          // The user made a left-to-right swipe
          // Throttle the callback to be called once every 2 seconds
          // console.log("User made -to-right gesture");
          // if (!drawerIsOpen.current) {
          handleRightToLeftSwipe();
          // }
        }
      },
    })
  ).current;

  const handleMessage = (event: WebViewMessageEvent) => {
    // console.log("MESSAGE: ", event.nativeEvent.data);
    messageHandler.current?.(event);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "white",
      }}
      {...panResponder.panHandlers}
    >
      <WebView
        ref={webviewRef}
        source={{ uri: "https://chat.openai.com/chat" }}
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        onMessage={handleMessage}
        style={{ marginTop: Constants.statusBarHeight }}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
      />
    </View>
  );
};

export default App;
