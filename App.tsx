import { throttle } from "lodash";
import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  PanResponder,
  BackHandler,
  StatusBar,
  TextInput,
  useColorScheme,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { setBackgroundColorAsync } from "expo-navigation-bar";

enum WebViewMessageType {
  GetIsDrawerOpen,
  SyncTheme,
  DismissKeyboard,
  ScrollStarted,
  ScrollEnded,
  ReloadPage,
}

type MessageData = {
  type: WebViewMessageType;
  value: any;
};

const useUpdateEffect = (
  effect: React.EffectCallback,
  deps: React.DependencyList
) => {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      return effect();
    }
  }, deps);
};

const refreshIcon = /* html */ `
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="25" viewBox="0 0 48 48">
    <path d="M24 40q-6.65 0-11.325-4.675Q8 30.65 8 24q0-6.65 4.675-11.325Q17.35 8 24 8q4.25 0 7.45 1.725T37 14.45V9.5q0-.65.425-1.075Q37.85 8 38.5 8q.65 0 1.075.425Q40 8.85 40 9.5v9.7q0 .65-.425 1.075-.425.425-1.075.425h-9.7q-.65 0-1.075-.425-.425-.425-.425-1.075 0-.65.425-1.075.425-.425 1.075-.425h6.9q-1.9-3-4.85-4.85Q27.9 11 24 11q-5.45 0-9.225 3.775Q11 18.55 11 24q0 5.45 3.775 9.225Q18.55 37 24 37q3.9 0 7.15-2.075Q34.4 32.85 36 29.35q.2-.4.65-.7.45-.3.9-.3.85 0 1.225.55.375.55.075 1.3-1.85 4.45-5.875 7.125T24 40Z"/>
  </svg>
`;

const headerSelector = "#__next > div:nth-of-type(1) > div > div";
const mainSelector = "#__next > div:nth-of-type(1) > div > main";
const conversationSelector = `${mainSelector} > div:nth-of-type(1) > div:nth-of-type(1) > div`;

const burgerButtonSelector = `${headerSelector} > button:nth-of-type(1)`;

const plusButtonSelector = `${headerSelector} > button:last-of-type`;

const drawerRoot = 'div[data-headlessui-state="open"]';
const drawerContentSelector = `${drawerRoot} nav`;

const injectedCss = /* css */ `
  html {
    font-size: 1.2rem;
  }

  ${headerSelector} button {
    box-shadow: none !important;
    color: currentColor !important;
    border: none !important;
    outline: none !important;
  }

  ${drawerContentSelector} button {
    box-shadow: none !important;
    color: currentColor !important;
    border: none !important;
    outline: none !important;
  }

  /* Add padding/margin for transparent status bar */
  ${headerSelector} {
    padding-top: calc(${StatusBar.currentHeight}px + 10px);
  }
  ${drawerContentSelector} {
    padding-top: calc(${StatusBar.currentHeight}px + 10px);
  }

  /* Hide new chat, dark node, discord, clear conversation, close button */
  ${drawerContentSelector} > a:nth-of-type(1) {
    display: none;
  }
  ${drawerContentSelector} > a:nth-of-type(2) {
    display: none;
  }
  ${drawerContentSelector} > a:nth-of-type(3) {
    display: none;
  }
  ${drawerContentSelector} > a:nth-of-type(4) {
    display: none;
  }
  #headlessui-portal-root button[type=button] {
    display: none;
  }

  main > div:last-of-type > form {
    margin-bottom: 0.5rem;
  }

  /* Hide examples, capabilities, limitations */
  main > div:nth-of-type(1) > div > div > div > div:nth-of-type(1) > div.items-start.text-center {
    display: none;
  }
  /* Align "ChatGPT" vertically */
  main > div:nth-of-type(1) > div > div > div > div:nth-of-type(1).px-6 {
    margin-top: auto;
    margin-bottom: auto;
  }

  /* Fix question content */
  main > div:nth-of-type(1) > div > div > div:nth-of-type(2n+1) > div > div:nth-of-type(2) > div:nth-of-type(1) {
    max-width: 100%;
    word-wrap: anywhere;
  }
  /* /chat page */
  main > div:nth-of-type(1) > div > div > div > div:nth-of-type(2n+1) > div > div:nth-of-type(2) > div:nth-of-type(1) {
    max-width: 100%;
    word-wrap: anywhere;
  }

  /* Fix answer content */
  /* /chat/... page */
  main > div:nth-of-type(1) > div > div > div:nth-of-type(2n+2) > div > div:nth-of-type(2) > div:nth-of-type(1) {
    max-width: 100%;
  }
  /* /chat page */
  main > div:nth-of-type(1) > div > div > div > div:nth-of-type(2n+2) > div > div:nth-of-type(2) > div:nth-of-type(1) {
    max-width: 100%;
  }

  /* Hide answer like / dislike buttons */
  main > div:nth-of-type(1) > div > div > div:nth-of-type(2n+2) > div > div:nth-of-type(2) > div:nth-of-type(2) {
    display: none;
  }
  main > div:nth-of-type(1) > div > div > div > div:nth-of-type(2n+2) > div > div:nth-of-type(2) > div:nth-of-type(2) {
    display: none;
  }

  /* Hide footer caption */
  main > div:last-of-type > div:last-of-type {
    display: none;
  }
`;

const setStyleInnerHtml = /* javascript */ `
  style.innerHTML = \`${injectedCss}\`;
`;

const insertRefreshButtonScript = /* javascript */ `
  var oldRefreshButton = document.querySelector("#refresh");
  console.log('oldRefreshButton', oldRefreshButton);

  if (!oldRefreshButton) {
    var header = document.querySelector("${headerSelector}");
    var plusButton = document.querySelector("${plusButtonSelector}");
    var refreshButton = document.createElement("button");
    refreshButton.id = "refresh";
    refreshButton.className = "px-3";
    refreshButton.innerHTML = \`${refreshIcon}\`;
    refreshButton.addEventListener("click", () => {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: ${WebViewMessageType.ReloadPage},
        }),
      );
    });

    header.insertBefore(refreshButton, plusButton);
    console.log('inserted refresh button');
  }
`;

const cssScript = /* javascript */ `
  var style = document.createElement('style');
  ${setStyleInnerHtml}
  document.head.appendChild(style);
`;

const html2canvasScript = /* javascript */ `
 var html2canvasScript = document.createElement("script");
  html2canvasScript.src = "https://html2canvas.hertzen.com/dist/html2canvas.min.js";
  document.body.appendChild(html2canvasScript);
  // html2canvasScript.onload = () => {
  //   console.log('html2canvas', html2canvas);
  // };
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
        console.log('href changed');

        // If chat page
        var url = new URL(currentHref);
        if (url.pathname !== '/chat') {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: ${WebViewMessageType.DismissKeyboard} }),
          );
        }

        // Delay DOM modifications while DOM is rerendering
        setTimeout(() => {
          ${insertRefreshButtonScript}
        }, 500);

        oldHref = currentHref;
      }
    });
  });
  // Listen to DOM changes
  observer.observe(body, { childList: true, subtree: true });
`;

const scrollScript = /* javascript */ `
  var scrollEndTimeoutId;
  window.addEventListener('scroll', (event) => {
    if (event.target.scrollLeft > 0) {
      if (scrollEndTimeoutId) {
        clearTimeout(scrollEndTimeoutId);
      } else {
        // console.log('Scroll started');
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: ${WebViewMessageType.ScrollStarted} }),
        );
      }
      scrollEndTimeoutId = setTimeout(() => {
        // console.log('Scroll ended');
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: ${WebViewMessageType.ScrollEnded} }),
        );
        scrollEndTimeoutId = 0;
      }, 1000);
    }
  }, 1);
`;

const cloudflareRefreshScript = /* javascript */ `
  setInterval(() => {
      location.reload();
  }, 3600000); // 1 hours (though it expires after 2 hours from issuing time)
`;

const drawerOpenHandlerScript = /* javascript */ `
  // var burgerButton = document.querySelector("${burgerButtonSelector}");
  // burgerButton.addEventListener("click", () => {
  //   var isDrawerOpen = !!document.querySelector('${drawerRoot}');
  //   if (!isDrawerOpen) {
  //     setTimeout(() => {

  //     }, 500);
  //   }
  // })
`;

// cohtml2canvasScriptnst drawer

const mainScript = /* javascript */ `
  ${cssScript}

  ${html2canvasScript}

  ${hrefChangeHandlerScript}

  ${scrollScript}

  ${cloudflareRefreshScript}

  ${insertRefreshButtonScript}

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

const COLOR_LIGHT = "#FFFFFF";
const COLOR_DARK = "#343541";

const App: React.FC = () => {
  const systemTheme = useColorScheme(); // dark mode

  const webviewRef = useRef<null | WebView>(null);
  const textInputRef = useRef<null | TextInput>(null);
  const messageHandler = useRef<((data: MessageData) => void) | null>(null);
  const wasLoaded = useRef(false);
  const isWebappScrollingX = useRef(false);

  const dismissKeyboard = useCallback(() => {
    textInputRef.current?.focus();
    textInputRef.current?.blur();
  }, []);

  const switchTheme = () => {
    webviewRef.current?.injectJavaScript(/* javascript */ `
      try {
        var drawerOpenObserver;
        drawerOpenObserver = new MutationObserver(() => {
          const switchThemeButton = document.querySelector("${drawerContentSelector} > a:nth-of-type(3)");
          // console.log("theme button:", switchThemeButton)
          if (switchThemeButton) {
            switchThemeButton.click();
            drawerOpenObserver.disconnect();
            // Close a drawer after call-stack is executed (async)
            setTimeout(() => {
              // Directly remove drawer from the DOM (workaround when closing using button is buggy)
              document.querySelector('#headlessui-portal-root').remove();
              // console.log("CLOSED")
            });
          }
        });

        var body = document.querySelector('body');
        drawerOpenObserver.observe(body, { childList: true});
        var switchDrawerButton = document.querySelector('button');
        switchDrawerButton.click();
      } catch (error) {
        console.error(error);
      }
    `);
    webviewRef.current?.requestFocus();
  };

  const handleOpenDrawler = () => {
    // console.log("open drawer");
    webviewRef.current?.injectJavaScript(/* javascript */ `
      try {
        // console.log('left to right');
        var isDrawerOpen = !!document.querySelector('${drawerRoot}');
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
        var isDrawerOpen = !!document.querySelector('${drawerRoot}');
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

  const handleHorizontalSwipe = useRef(
    throttle(
      (dx: number) => (dx > 0 ? handleOpenDrawler() : handleCloseDrawler()),
      500,
      { trailing: false }
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
    handleBackButtonAsync();
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
        !isWebappScrollingX.current &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
        // Swipe delta
        Math.sqrt(
          Math.pow(Math.abs(gestureState.dx), 2) +
            Math.pow(Math.abs(gestureState.dy), 2)
        ) > 70,
      onPanResponderMove: (_event, gestureState) => {
        handleHorizontalSwipe(gestureState.dx);
      },
    })
  ).current;

  const handleSyncTheme = async (data: MessageData) => {
    try {
      // Sync system and webapp themes
      // console.log("System theme:", systemTheme);
      // console.log("Webapp theme:", data.value);
      if (systemTheme !== data.value) {
        // console.log("Switching theme");
        setTimeout(() => switchTheme(), 1000);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    const data: MessageData = JSON.parse(event.nativeEvent.data);

    if (data.type === WebViewMessageType.ReloadPage) {
      webviewRef.current?.reload();
      return;
    }

    if (data.type === WebViewMessageType.SyncTheme) {
      handleSyncTheme(data);
      return;
    }

    if (data.type === WebViewMessageType.DismissKeyboard) {
      dismissKeyboard();
      return;
    }

    if (data.type === WebViewMessageType.ScrollStarted) {
      isWebappScrollingX.current = true;
      return;
    }

    if (data.type === WebViewMessageType.ScrollEnded) {
      isWebappScrollingX.current = false;
      return;
    }

    if (data.type === WebViewMessageType.GetIsDrawerOpen) {
      messageHandler.current?.(data);
    }
  };

  const handleWebViewLoaded = useCallback(async () => {
    if (!wasLoaded.current) {
      webviewRef.current?.requestFocus();

      await setBackgroundColorAsync(
        systemTheme === "light" ? COLOR_LIGHT : COLOR_DARK
      );
      wasLoaded.current = true;
    }
  }, []);

  useUpdateEffect(() => {
    switchTheme();
    setBackgroundColorAsync(systemTheme === "light" ? COLOR_LIGHT : COLOR_DARK);
  }, [systemTheme]);

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
        source={{ uri: "https://chat.openai.com/auth/ext_callback?next=" }}
        originWhitelist={["*"]}
        domStorageEnabled
        cacheEnabled={false}
        // cacheMode="LOAD_DEFAULT"
        cacheMode="LOAD_NO_CACHE"
        onMessage={handleMessage}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        keyboardDisplayRequiresUserAction={false}
        onLoad={handleWebViewLoaded}
        bounces
        pullToRefreshEnabled
        overScrollMode="never"
      />
      <TextInput ref={textInputRef} autoFocus style={{ display: "none" }} />
    </View>
  );
};

export default App;
