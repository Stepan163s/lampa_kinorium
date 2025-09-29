(function() {
    'use strict';
    
    // Ждем загрузки Lampa
    if (typeof Lampa === 'undefined') {
        setTimeout(arguments.callee, 100);
        return;
    }

    var network = new Lampa.Request();

    function calculateProgress(total, current) {
        if(total == current) {
            Lampa.Noty.show('Обновление списка фильмов Кинориума завершено');
            if(Lampa.Storage.get('kinorium_launched_before', false) == false) {
                Lampa.Storage.set('kinorium_launched_before', true);
                Lampa.Activity.push({
                    title: 'Кинориум',
                    component: 'kinorium',
                    page: 1
                });
            }
        }
    }

    function parseKinoriumHTML(html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var movies = [];
        
        var movieElements = doc.querySelectorAll('.statusWidgetData[data-movieId]');
        
        for (var i = 0; i < movieElements.length; i++) {
            var element = movieElements[i];
            var movieId = element.getAttribute('data-movieId');
            var movieName = element.getAttribute('data-movieName');
            
            var titleElement = element.querySelector('.movie-title__text');
            var russianTitle = titleElement ? titleElement.textContent.trim() : movieName;
            
            var smallElement = element.querySelector('small');
            var originalTitle = '';
            var year = '';
            
            if (smallElement) {
                var smallText = smallElement.textContent.trim();
                var lastCommaIndex = smallText.lastIndexOf(',');
                if (lastCommaIndex !== -1) {
                    originalTitle = smallText.substring(0, lastCommaIndex).trim();
                    year = smallText.substring(lastCommaIndex + 1).trim();
                } else {
                    originalTitle = smallText;
                }
            }
            
            var isSerial = element.querySelector('.status-list__serial_text') !== null;
            
            movies.push({
                kinorium_id: movieId,
                russianTitle: russianTitle,
                originalTitle: originalTitle,
                year: year,
                isSerial: isSerial,
                timestamp: element.getAttribute('data-timestamp')
            });
        }
        
        return movies;
    }

    function processKinoriumData(html) {
        var movies = parseKinoriumHTML(html);
            
        if(movies.length == 0) {
            Lampa.Noty.show('В списке "Буду смотреть" Кинориума нет фильмов');
            return;
        }

        var kinoriumMovies = Lampa.Storage.get('kinorium_movies', []);
        var receivedMovieIds = {};
        for (var i = 0; i < movies.length; i++) {
            receivedMovieIds[String(movies[i].kinorium_id)] = true;
        }
        
        var filteredMovies = [];
        for (var j = 0; j < kinoriumMovies.length; j++) {
            if (receivedMovieIds[String(kinoriumMovies[j].kinorium_id)]) {
                filteredMovies.push(kinoriumMovies[j]);
            }
        }
        kinoriumMovies = filteredMovies;
        Lampa.Storage.set('kinorium_movies', kinoriumMovies);
        
        var processedItems = 1;
        
        for (var k = 0; k < movies.length; k++) {
            (function(m, index) {
                var existsInLocalStorage = false;
                for (var l = 0; l < kinoriumMovies.length; l++) {
                    if (kinoriumMovies[l].kinorium_id === String(m.kinorium_id)) {
                        existsInLocalStorage = true;
                        break;
                    }
                }
                
                if (!existsInLocalStorage) {
                    var movieType = m.isSerial ? 'tv' : 'movie';
                    var searchTitle = m.originalTitle || m.russianTitle;
                    
                    var url = Lampa.Utils.protocol() + 'tmdb.'+ Lampa.Manifest.cub_domain +'/3/search/' + movieType + 
                             '?query=' + encodeURIComponent(searchTitle) + 
                             '&api_key=4ef0d7355d9ffb5151e987764708ce96' + 
                             (m.year ? '&year=' + String(m.year) : '') + 
                             '&language=ru';
                    
                    network.silent(url, function(data) {
                        if(data && data.results && data.results[0]) {
                            var movieItem = data.results[0];
                            
                            var movieDateStr = movieItem.release_date || movieItem.first_air_date;
                            var movieDate = new Date(movieDateStr);

                            if (movieDate <= new Date()) {                                            
                                movieItem.kinorium_id = String(m.kinorium_id);
                                movieItem.source = "tmdb";
                                var currentMovies = Lampa.Storage.get('kinorium_movies', []);
                                currentMovies.unshift(movieItem);
                                Lampa.Storage.set('kinorium_movies', currentMovies);
                            } else {
                                if (Lampa.Storage.get('kinorium_add_to_favorites', false)) {
                                    Lampa.Favorite.add('wath', movieItem, 100);
                                }
                            }
                        }
                        calculateProgress(movies.length, index);
                    }, function(error) {
                        calculateProgress(movies.length, index);
                    });
                } else {
                    calculateProgress(movies.length, index);
                }
            })(movies[k], processedItems);
            processedItems++;
        }
    }

    function getKinoriumData() {
        var userId = Lampa.Storage.get('kinorium_user_id', '');
        
        if (!userId) {
            Lampa.Noty.show('Укажите ID пользователя Кинориума в настройках');
            return;
        }
        
        var proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://ru.kinorium.com/user/' + userId + '/watchlist/');
        
        network.silent(proxyUrl, function(html) {
            processKinoriumData(html);
        }, function(error) {
            Lampa.Noty.show('Ошибка при получении данных с Кинориума');
        });
    }

    function full(params, oncomplete, onerror) {
        var userId = Lampa.Storage.get('kinorium_user_id', '');
        if(userId) {
            getKinoriumData();
        }
        oncomplete({
            "success": true,
            "page": 1,
            "results": Lampa.Storage.get('kinorium_movies', [])
        });
    }

    function clear() {
        network.clear();
    }

    function component(object) {
        var comp = new Lampa.InteractionCategory(object);
        comp.create = function() {
            full(object, this.build.bind(this), this.empty.bind(this));
        };
        comp.nextPageReuest = function(object, resolve, reject) {
            full(object, resolve.bind(comp), reject.bind(comp));
        };
        return comp;
    }

    function startPlugin() {
        // Проверяем, что все необходимые компоненты Lampa загружены
        if (!Lampa.Manifest || !Lampa.Component || !Lampa.SettingsApi) {
            setTimeout(startPlugin, 100);
            return;
        }

        var manifest = {
            type: 'video',
            version: '0.4.0',
            name: 'Кинориум',
            description: '',
            component: 'kinorium'
        };
        
        // Регистрируем плагин
        if (Lampa.Manifest.plugins) {
            Lampa.Manifest.plugins.push(manifest);
        }
        
        if (Lampa.Component.add) {
            Lampa.Component.add('kinorium', component);
        }

        // Добавляем кнопку в меню
        function addMenuButton() {
            if (!$('.menu .menu__list').length) {
                setTimeout(addMenuButton, 100);
                return;
            }
            
            var button = $('<li class="menu__item selector"><div class="menu__ico"><svg width="239" height="239" viewBox="0 0 239 239" fill="currentColor" xmlns="http://www.w3.org/2000/svg" xml:space="preserve"><path fill="currentColor" d="M215 121.415l-99.297-6.644 90.943 36.334a106.416 106.416 0 0 0 8.354-29.69z" /><path fill="currentColor" d="M194.608 171.609C174.933 197.942 143.441 215 107.948 215 48.33 215 0 166.871 0 107.5 0 48.13 48.33 0 107.948 0c35.559 0 67.102 17.122 86.77 43.539l-90.181 48.07L162.57 32.25h-32.169L90.892 86.862V32.25H64.77v150.5h26.123v-54.524l39.509 54.524h32.169l-56.526-57.493 88.564 46.352z" /><path d="M206.646 63.895l-90.308 36.076L215 93.583a106.396 106.396 0 0 0-8.354-29.688z" fill="currentColor"/></svg></div><div class="menu__text">Кинориум</div></li>');
            
            button.on('hover:enter', function() {
                Lampa.Activity.push({
                    title: 'Кинориум',
                    component: 'kinorium',
                    page: 1
                });
            });
            
            $('.menu .menu__list').eq(0).append(button);
        }

        // Добавляем настройки
        function addSettings() {
            if (!Lampa.SettingsApi.addComponent) {
                setTimeout(addSettings, 100);
                return;
            }

            // Инициализируем lampa_settings если не существует
            window.lampa_settings = window.lampa_settings || {};
            
            if (!window.lampa_settings.kinorium) {
                Lampa.SettingsApi.addComponent({
                    component: 'kinorium',
                    icon: '<svg width="239" height="239" viewBox="0 0 239 239" fill="currentColor" xmlns="http://www.w3.org/2000/svg" xml:space="preserve"><path fill="currentColor" d="M215 121.415l-99.297-6.644 90.943 36.334a106.416 106.416 0 0 0 8.354-29.69z" /><path fill="currentColor" d="M194.608 171.609C174.933 197.942 143.441 215 107.948 215 48.33 215 0 166.871 0 107.5 0 48.13 48.33 0 107.948 0c35.559 0 67.102 17.122 86.77 43.539l-90.181 48.07L162.57 32.25h-32.169L90.892 86.862V32.25H64.77v150.5h26.123v-54.524l39.509 54.524h32.169l-56.526-57.493 88.564 46.352z" /><path d="M206.646 63.895l-90.308 36.076L215 93.583a106.396 106.396 0 0 0-8.354-29.688z" fill="currentColor"/></svg>',
                    name: 'Кинориум'
                });
                
                Lampa.SettingsApi.addParam({
                    component: 'kinorium',
                    param: {
                        type: 'title'
                    },
                    field: {
                        name: 'Аккаунт',
                    }
                });
                
                var currentUserId = Lampa.Storage.get('kinorium_user_id', '');
                Lampa.SettingsApi.addParam({
                    component: 'kinorium',
                    param: {
                        type: 'button',
                        name: 'kinorium_set_user_id'
                    },
                    field: {
                        name: currentUserId ? 'ID: ' + currentUserId : 'Установить ID пользователя',
                        description: 'Нажмите чтобы установить ваш ID пользователя Кинориум'
                    },
                    onChange: function() {
                        // Используем Lampa.Input вместо Lampa.Dialog.field
                        Lampa.Input({
                            title: 'Введите ID пользователя Кинориум',
                            value: currentUserId || '',
                            type: 'text'
                        }, function(id) {
                            if (id) {
                                Lampa.Storage.set('kinorium_user_id', id);
                                Lampa.Noty.show('ID пользователя установлен');
                                // Обновляем отображение
                                setTimeout(function() {
                                    var element = $('div[data-name="kinorium_set_user_id"]');
                                    if (element.length) {
                                        element.find('.settings-param__name').text('ID: ' + id);
                                    }
                                }, 100);
                            }
                        });
                    }
                });
                
                Lampa.SettingsApi.addParam({
                    component: 'kinorium',
                    param: {
                        type: 'title'
                    },
                    field: {
                        name: 'Список "Буду смотреть"',
                    }
                });
                
                Lampa.SettingsApi.addParam({
                    component: 'kinorium',
                    param: {
                        name: 'kinorium_add_to_favorites',
                        type: 'trigger',
                        default: false
                    },
                    field: {
                        name: 'Добавлять в Избранное',
                        description: 'Будущие, еще не вышедшие релизы добавляются в список Позже'
                    }
                });
                
                Lampa.SettingsApi.addParam({
                    component: 'kinorium',
                    param: {
                        type: 'button',
                        name: 'kinorium_refresh'
                    },
                    field: {
                        name: 'Обновить список',
                        description: 'Загрузить актуальный список фильмов'
                    },
                    onChange: function() {
                        getKinoriumData();
                    }
                });
                
                Lampa.SettingsApi.addParam({
                    component: 'kinorium',
                    param: {
                        type: 'button',
                        name: 'kinorium_delete_cache'
                    },
                    field: {
                        name: 'Очистить кэш фильмов',
                        description: 'Необходимо при возникновении проблем'
                    },
                    onChange: function() {
                        Lampa.Storage.set('kinorium_movies', []);
                        Lampa.Noty.show('Кэш Кинориума очищен');
                    }
                });
                
                window.lampa_settings.kinorium = true;
            }
        }

        // Запускаем добавление элементов интерфейса
        if (window.appready) {
            addMenuButton();
            addSettings();
        } else {
            Lampa.Listener.follow('app', function(e) {
                if (e.type == 'ready') {
                    addMenuButton();
                    addSettings();
                }
            });
        }
    }

    // Запускаем плагин после полной загрузки Lampa 2
    if (!window.kinorium_ready) {
        window.kinorium_ready = true;
        
        if (window.appready) {
            startPlugin();
        } else {
            Lampa.Listener.follow('app', function(e) {
                if (e.type == 'ready') {
                    startPlugin();
                }
            });
        }
    }
})();