(function() {
    'use strict';
    var network = new Lampa.Reguest();

    function testInternetConnection() {
        console.log('Testing internet connection...');

        var testUrls = [
            'https://www.google.com',
            'https://ya.ru',
            'https://api.alloha.tv/?token=04941a9a3ca3ac16e2b4327347bbc1&name=test',
            Lampa.Utils.protocol() + 'tmdb.' + Lampa.Manifest.cub_domain + '/3/movie/550?api_key=4ef0d7355d9ffb5151e987764708ce96'
        ];

        function testNextUrl(index) {
            if (index >= testUrls.length) {
                Lampa.Noty.show('Все тестовые запросы не удались — проблема с интернетом');
                return;
            }

            var url = testUrls[index];
            console.log('Testing URL:', url);

            network.silent(url, function(data) {
                console.log('SUCCESS: URL worked:', url);
                Lampa.Noty.show('Интернет работает! URL: ' + url);
            }, function(error) {
                console.log('FAILED: URL failed:', url, error);
                testNextUrl(index + 1);
            });
        }

        testNextUrl(0);
    }

    function startPlugin() {
        if (!window.lampa_settings.kinorium_test) {
            Lampa.SettingsApi.addComponent({
                component: 'kinorium_test',
                icon: '⚡️',
                name: 'Тест интернета / прокси'
            });
        }

        Lampa.SettingsApi.addParam({
            component: 'kinorium_test',
            param: { type: 'title' },
            field: { name: 'Проверка подключения' }
        });

        Lampa.SettingsApi.addParam({
            component: 'kinorium_test',
            param: { type: 'button', name: 'test_internet' },
            field: {
                name: 'Проверить интернет',
                description: 'Тестовые запросы к разным сервисам'
            },
            onChange: () => {
                testInternetConnection();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'kinorium_test',
            param: { type: 'button', name: 'test_kinorium' },
            field: {
                name: 'Проверить Кинориум (прямой)',
                description: 'Прямой запрос к Кинориуму'
            },
            onChange: () => {
                var testUrl = 'https://ru.kinorium.com/user/928543/watchlist/';
                console.log('Testing Kinorium URL:', testUrl);

                network.silent(testUrl, function(data) {
                    console.log('Kinorium SUCCESS:', data);
                    Lampa.Noty.show('Кинориум доступен (прямой запрос)!');
                }, function(error) {
                    console.log('Kinorium FAILED:', error);
                    Lampa.Noty.show('Кинориум недоступен (прямой): ' + (error.decode_error || error.statusText));
                });
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'kinorium_test',
            param: { type: 'button', name: 'test_kinorium_proxy' },
            field: {
                name: 'Проверить Кинориум (через Google Proxy)',
                description: 'Запрос к Кинориуму через Google Apps Script'
            },
            onChange: () => {
                var proxyBase = 'https://script.google.com/macros/s/AKfycbx-K7Z8Bbcplv-kTRhSsfG2PLyCh-oRFpKba1kk6IYoltuimlcPC73mZEX4oOOP-C6I/exec';
                var targetUrl = encodeURIComponent('https://ru.kinorium.com/user/928543/watchlist/');
                var finalUrl = proxyBase + '?url=' + targetUrl;

                console.log('Testing Kinorium via Proxy:', finalUrl);

                network.silent(finalUrl, function(data) {
                    console.log('Kinorium Proxy SUCCESS:', data);
                    Lampa.Noty.show('Кинориум через Proxy доступен!');
                }, function(error) {
                    console.log('Kinorium Proxy FAILED:', error);
                    Lampa.Noty.show('Кинориум через Proxy недоступен: ' + (error.decode_error || error.statusText));
                });
            }
        });
    }

    if (!window.internet_test_ready) {
        window.internet_test_ready = true;
        startPlugin();
    }
})();