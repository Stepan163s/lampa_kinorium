(function() {
    'use strict';

    // Поддержка разных имен конструктора для запросов в разных билдах Lampa
    var network;
    try {
        if (typeof Lampa !== 'undefined') {
            if (typeof Lampa.Request !== 'undefined') network = new Lampa.Request();
            else if (typeof Lampa.Reguest !== 'undefined') network = new Lampa.Reguest();
            else {
                // fallback: попытка создать Request если есть (на всякий)
                network = (Lampa.Request) ? new Lampa.Request() : null;
            }
        }
    } catch (e) {
        network = null;
        console.error('Network constructor not found:', e);
    }

    // Если network так и не получился — создаём "заглушку", чтобы не падать
    if (!network) {
        network = {
            silent: function(url, success, error) {
                console.warn('Network not available. Silent call to', url);
                if (typeof error === 'function') error({ message: 'Network unavailable' });
            },
            clear: function() {}
        };
    }

    function testInternetConnection() {
        console.log('Testing internet connection...');

        var testUrls = [
            'https://www.google.com',
            'https://ya.ru',
            'https://api.alloha.tv/?token=04941a9a3ca3ac16e2b4327347bbc1&name=test',
            (typeof Lampa !== 'undefined' && Lampa.Utils && Lampa.Manifest) ? (Lampa.Utils.protocol() + 'tmdb.' + Lampa.Manifest.cub_domain + '/3/movie/550?api_key=4ef0d7355d9ffb5151e987764708ce96') : 'https://api.themoviedb.org/3/movie/550?api_key=4ef0d7355d9ffb5151e987764708ce96'
        ];

        function testNextUrl(index) {
            if (index >= testUrls.length) {
                Lampa.Noty.show('Все тестовые запросы не удались — возможно проблема с интернетом');
                return;
            }

            var url = testUrls[index];
            console.log('Testing URL:', url);

            network.silent(url, function(data) {
                console.log('SUCCESS: URL worked:', url, data);
                Lampa.Noty.show('Интернет работает! Успешный URL: ' + url);
            }, function(error) {
                console.log('FAILED: URL failed:', url, error);
                // идём к следующему URL
                testNextUrl(index + 1);
            });
        }

        testNextUrl(0);
    }

    function testKinoriumDirect() {
        var testUrl = 'https://ru.kinorium.com/user/928543/watchlist/';
        console.log('Testing Kinorium direct URL:', testUrl);

        network.silent(testUrl, function(data) {
            console.log('Kinorium direct SUCCESS:', data);
            Lampa.Noty.show('Кинориум доступен напрямую (возможно CORS не проблема в твоей среде)');
        }, function(error) {
            console.log('Kinorium direct FAILED:', error);
            var msg = 'Кинориум недоступен напрямую';
            if (error && (error.decode_error || error.statusText)) msg += ': ' + (error.decode_error || error.statusText);
            Lampa.Noty.show(msg);
        });
    }

    function testKinoriumViaProxy() {
        var proxyBase = 'https://script.google.com/macros/s/AKfycbx-K7Z8Bbcplv-kTRhSsfG2PLyCh-oRFpKba1kk6IYoltuimlcPC73mZEX4oOOP-C6I/exec';
        var target = 'https://ru.kinorium.com/user/928543/watchlist/';
        var finalUrl = proxyBase + '?url=' + encodeURIComponent(target);

        console.log('Testing Kinorium via Google Proxy:', finalUrl);

        network.silent(finalUrl, function(data) {
            console.log('Kinorium Proxy SUCCESS. Response length:', (data && data.length) ? data.length : 'unknown');
            Lampa.Noty.show('Кинориум через Proxy доступен! Длина ответа: ' + (data.length || 'unknown'));
        }, function(error) {
            console.log('Kinorium Proxy FAILED:', error);
            Lampa.Noty.show('Кинориум через Proxy недоступен: ' + (error.decode_error || error.statusText));
        }, {
            dataType: 'text'   // <<< добавляем вот это
        });
    }

    function startPlugin() {
        var compName = 'kinorium_test';
        if (!window.lampa_settings) window.lampa_settings = window.lampa_settings || {};
        if (!window.lampa_settings[compName]) {
            Lampa.SettingsApi.addComponent({
                component: compName,
                icon: '⚡️',
                name: 'Тест интернета / прокси'
            });
        }

        // Заголовок
        Lampa.SettingsApi.addParam({
            component: compName,
            param: { type: 'title' },
            field: { name: 'Проверка подключения' }
        });

        // Кнопка: базовый тест интернета
        Lampa.SettingsApi.addParam({
            component: compName,
            param: { type: 'button', name: 'test_internet' },
            field: {
                name: 'Проверить интернет',
                description: 'Тестовые запросы к разным сервисам'
            },
            onChange: function() {
                testInternetConnection();
            }
        });

        // Кнопка: прямой запрос к Кинориуму
        Lampa.SettingsApi.addParam({
            component: compName,
            param: { type: 'button', name: 'test_kinorium_direct' },
            field: {
                name: 'Проверить Кинориум (прямой)',
                description: 'Попытка прямого запроса к ru.kinorium.com'
            },
            onChange: function() {
                testKinoriumDirect();
            }
        });

        // Кнопка: запрос через Google Apps Script proxy
        Lampa.SettingsApi.addParam({
            component: compName,
            param: { type: 'button', name: 'test_kinorium_proxy' },
            field: {
                name: 'Проверить Кинориум (через Google Proxy)',
                description: 'Запрос через твой Google Apps Script (вставлен URL автоматически)'
            },
            onChange: function() {
                testKinoriumViaProxy();
            }
        });

        // Устанавливаем флаг
        window.lampa_settings[compName] = true;

        console.log('Kinorium test plugin initialized. Proxy URL:', 'https://script.google.com/macros/s/AKfycbx-K7Z8Bbcplv-kTRhSsfG2PLyCh-oRFpKba1kk6IYoltuimlcPC73mZEX4oOOP-C6I/exec');
    }

    if (!window.internet_test_ready) {
        window.internet_test_ready = true;
        if (window.appready) startPlugin();
        else Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') startPlugin();
        });
    }
})();