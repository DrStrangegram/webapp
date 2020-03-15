// Put all packages together.
// Used to generate umd/index.prod.js
import 'react-hot-loader/patch';

import '../css/base.css';
import '../firebase-init';

import React from 'react';
import ReactDOM from 'react-dom';

import { AppContainer } from 'react-hot-loader';
import { IntlProvider } from 'react-intl';

import allMessages from './messages.json';
import TinodeWeb from './views/tinode-web.jsx';
import HashNavigation from './lib/navigation.js';

// Detect human language to use in the UI:
//  Check parameters from URL hash #?hl=ru, then browser, then use 'en' as a fallback.
const { params } = HashNavigation.parseUrlHash(window.location.hash);
const language = (params && params.hl) ||
  (navigator.languages && navigator.languages[0]) ||
  navigator.language ||
  navigator.userLanguage ||
  'en';

// Get the base language 'en' from a more specific 'en_GB' or 'en-US' as a partial fallback.
const baseLanguage = language.toLowerCase().split(/[-_]/)[0];

// Try the full locale first, then the locale without the region code, fallback to 'en'.
const messages =
  allMessages[language] ||
  allMessages[baseLanguage] ||
  allMessages.en;

const render = function(RootComponent) {
  ReactDOM.render(
    <AppContainer>
      <IntlProvider locale={language} messages={messages} textComponent={React.Fragment}>
        <RootComponent />
      </IntlProvider>
    </AppContainer>,
    document.getElementById('mountPoint')
  );
}

render(TinodeWeb);

if (module.hot) {
  module.hot.accept('./views/tinode-web.jsx', () => {
    const NextRootContainer = require('./views/tinode-web.jsx').default;
    render(NextRootContainer);
  })
}