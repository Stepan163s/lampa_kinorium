(function() {
    'use strict';
    var network = new Lampa.Reguest();

    function testAllowedDomains() {
        console.log('Testing allowed domains in Lampa...');
        
        var testUrls = [
            // Разрешенные домены Lampa
            Lampa.Utils.protocol() + 'tmdb.'+ Lampa.Manifest.cub_domain +'/3/movie/550?api_key=4ef0d7355d9ffb5151e987764708ce96',
            'https://api.alloha.tv/?token=04941a9a3ca3ac16e2b4327347bbc1&name=test',
            'https://lampa.app/',
            'https://cub.red/',
            
            // Сторонние домены (скорее всего заблокированы)
            'https://www.google.com',
            'https://ru.kinorium.com',
            'https://api.codetabs.com/v1/proxy?quest=https://ru.kinorium.com',
        ];
        
        function testNextUrl(index) {
            if (index >= testUrls.length) return;
            
            var url = testUrls[index];
            console.log('Testing URL:', url);
            
            network.silent(url, function(data) {
                console.log('✓ ALLOWED:', url);
                Lampa.Noty.show('Разрешено: ' + new URL(url).hostname);
                testNextUrl(index + 1);
            }, function(error) {
                console.log('✗ BLOCKED:', url, error);
                Lampa.Noty.show('Заблокировано: ' + new URL(url).hostname);
                testNextUrl(index + 1);
            });
        }
        
        testNextUrl(0);
    }

    function testKinoriumWorkaround() {
        console.log('Testing Kinorium workarounds...');
        
        // Пробуем разные обходные пути
        var workarounds = [
            // Через Alloha API для поиска (если знаем названия фильмов)
            'https://api.alloha.tv/?token=04941a9a3ca3ac16e2b4327347bbc1&name=матрица',
            
            // Пробуем использовать куб домен как прокси
            Lampa.Utils.protocol() + 'tmdb.'+ Lampa.Manifest.cub_domain +'/3/search/movie?query=матрица&api_key=4ef0d7355d9ffb5151e987764708ce96',
            
            // Пробуем другие разрешенные API
            'https://api.kinopoisk.dev/v1.3/movie?page=1&limit=10&selectFields=name&token=XXX'
        ];
        
        workarounds.forEach((url, index) => {
            network.silent(url, function(data) {
                console.log('Workaround SUCCESS:', index, url, data);
                Lampa.Noty.show('Обходной путь ' + index + ' работает!');
            }, function(error) {
                console.log('Workaround FAILED:', index, url, error);
            });
        });
    }

    function startPlugin() {
        if(!window.lampa_settings.kinorium_debug) {
            Lampa.SettingsApi.addComponent({
                component: 'kinorium_debug',
                icon: '🔧',
                name: 'Диагностика Кинориума'
            });
        }

        Lampa.SettingsApi.addParam({
            component: 'kinorium_debug',
            param: {
                type: 'title'
            },
            field: {
                name: 'Диагностика подключения',
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'kinorium_debug',
            param: {
                type: 'button',
                name: 'test_domains'
            },
            field: {
                name: 'Проверить разрешенные домены',
                description: 'Какие домены разрешены в Lampa'
            },
            onChange: () => {
                testAllowedDomains();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'kinorium_debug',
            param: {
                type: 'button',
                name: 'test_workarounds'
            },
            field: {
                name: 'Тест обходных путей',
                description: 'Проверить альтернативные методы'
            },
            onChange: () => {
                testKinoriumWorkaround();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'kinorium_debug',
            param: {
                type: 'title'
            },
            field: {
                name: 'Решение проблемы',
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'kinorium_debug',
            param: {
                type: 'button',
                name: 'show_solution'
            },
            field: {
                name: 'Показать решение',
                description: 'Как обойти ограничения Lampa'
            },
            onChange: () => {
                Lampa.Noty.show('Используем Google Apps Script как прокси (как в плагине Кинопоиска)');
            }
        });
    }

    if(!window.kinorium_debug_ready) {
        window.kinorium_debug_ready = true;
        startPlugin();
    }
})();