(function() {
    'use strict';
    var network = new Lampa.Reguest();

    function requestKinoriumUserId(callback) {
        Lampa.Input.edit({
            free: true,
            title: 'Введите ID пользователя Кинориума',
            nosave: true,
            value: '',
            layout: 'default',
            keyboard: 'lampa'
        }, function(input) {
            if (input) {
                Lampa.Storage.set('kinorium_user_id', input);
                Lampa.Noty.show('ID пользователя сохранен');
                if (callback) callback();
            } else {
                Lampa.Noty.show('ID пользователя не введен');
            }
        });
    }

    function calculateProgress(total, current) {
        if(total == current) {
            Lampa.Noty.show('Обновление списка фильмов Кинориума завершено (' + String(total) + ')');
            if(Lampa.Storage.get('kinorium_launched_before', false) == false) {
                Lampa.Storage.set('kinorium_launched_before', true);
                Lampa.Activity.push({
                    url: '',
                    title: 'Кинориум',
                    component: 'kinorium',
                    page: 1
                });
            }
        }
    }

    function parseKinoriumHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const movies = [];
        
        // Находим все элементы с фильмами
        const movieElements = doc.querySelectorAll('.statusWidgetData[data-movieId]');
        
        movieElements.forEach(element => {
            const movieId = element.getAttribute('data-movieId');
            const movieName = element.getAttribute('data-movieName');
            
            // Извлекаем русское название
            const titleElement = element.querySelector('.movie-title__text');
            const russianTitle = titleElement ? titleElement.textContent.trim() : movieName;
            
            // Извлекаем оригинальное название и год
            const smallElement = element.querySelector('small');
            let originalTitle = '';
            let year = '';
            
            if (smallElement) {
                const smallText = smallElement.textContent.trim();
                // Пытаемся разделить оригинальное название и год
                const lastCommaIndex = smallText.lastIndexOf(',');
                if (lastCommaIndex !== -1) {
                    originalTitle = smallText.substring(0, lastCommaIndex).trim();
                    year = smallText.substring(lastCommaIndex + 1).trim();
                } else {
                    originalTitle = smallText;
                }
            }
            
            // Проверяем, является ли сериалом
            const isSerial = element.querySelector('.status-list__serial_text') !== null;
            
            // Проверяем, находится ли в топе
            const isTop = element.querySelector('.status-list__top') !== null;
            
            movies.push({
                id: movieId,
                russianTitle: russianTitle,
                originalTitle: originalTitle,
                year: year,
                isSerial: isSerial,
                isTop: isTop,
                timestamp: element.getAttribute('data-timestamp')
            });
        });
        
        return movies;
    }

    function processKinoriumData(html) {
        try {
            var kinoriumMovies = Lampa.Storage.get('kinorium_movies', []);
            var receivedMovies = parseKinoriumHTML(html);
            var receivedMoviesCount = receivedMovies.length;
            
            console.log('Kinorium', "Movies received count: " + String(receivedMoviesCount));
            
            if(receivedMoviesCount == 0) {
                Lampa.Noty.show('В списке "Буду смотреть" Кинориума нет фильмов');
                return;
            }
            
            const receivedMovieIds = new Set(receivedMovies.map(m => String(m.id)));
            kinoriumMovies = kinoriumMovies.filter(movie => receivedMovieIds.has(String(movie.kinorium_id)));
            Lampa.Storage.set('kinorium_movies', JSON.stringify(kinoriumMovies));
            
            let processedItems = 1;
            
            receivedMovies.forEach(m => {
                const existsInLocalStorage = kinoriumMovies.some(km => km.kinorium_id === String(m.id));
                
                if (!existsInLocalStorage) {
                    console.log('Kinorium', 'Getting details for movie: ' + String(m.id) + ', title: ' + m.russianTitle);
                    
                    // Используем Alloha API для поиска
                    var searchTitle = m.originalTitle || m.russianTitle;
                    var searchUrl = 'https://api.alloha.tv/?token=04941a9a3ca3ac16e2b4327347bbc1&name=' + encodeURIComponent(searchTitle);
                    
                    if (m.year) {
                        searchUrl += '&year=' + m.year;
                    }
                    
                    network.silent(searchUrl, function(data) {
                        if (data && data.data && data.data.length > 0) {
                            var movieData = data.data[0];
                            var movieTMDBid = movieData.id_tmdb;
                            var movieType = movieData.category == 1 ? 'movie' : 'tv';
                            
                            if (movieTMDBid) {
                                console.log('Kinorium', 'TMDB id found: ' + String(movieTMDBid) + ' for movie: ' + searchTitle);
                                var url = Lampa.Utils.protocol() + 'tmdb.'+ Lampa.Manifest.cub_domain +'/3/' + movieType + '/' + String(movieTMDBid) + '?api_key=4ef0d7355d9ffb5151e987764708ce96&language=ru';
                                
                                network.silent(url, function(tmdbData) {
                                    if(tmdbData) {
                                        var movieDateStr = tmdbData.release_date || tmdbData.first_air_date;
                                        var movieDate = new Date(movieDateStr);

                                        if (movieDate <= new Date()) {                                            
                                            tmdbData.kinorium_id = String(m.id);
                                            tmdbData.source = "tmdb";
                                            kinoriumMovies = Lampa.Storage.get('kinorium_movies', []);
                                            kinoriumMovies.unshift(tmdbData);
                                            Lampa.Storage.set('kinorium_movies', JSON.stringify(kinoriumMovies));
                                        } else {
                                            console.log('Kinorium', 'Movie not released yet: ' + searchTitle);
                                            if (Lampa.Storage.get('kinorium_add_to_favorites', false)) {
                                                Lampa.Favorite.add('wath', tmdbData, 100);
                                            }
                                        }
                                    }
                                    calculateProgress(receivedMoviesCount, processedItems++);
                                }, function() {
                                    calculateProgress(receivedMoviesCount, processedItems++);
                                });
                            } else {
                                // Если TMDB id не найден, ищем через поиск TMDB
                                var searchType = m.isSerial ? 'tv' : 'movie';
                                var tmdbSearchUrl = Lampa.Utils.protocol() + 'tmdb.'+ Lampa.Manifest.cub_domain +'/3/search/' + searchType + '?query=' + encodeURIComponent(searchTitle) + '&api_key=4ef0d7355d9ffb5151e987764708ce96&year=' + String(m.year || '') + '&language=ru';
                                
                                network.silent(tmdbSearchUrl, function(searchData) {
                                    if(searchData && searchData.results && searchData.results[0]) {
                                        var movieItem = searchData.results[0];
                                        var movieDateStr = movieItem.release_date || movieItem.first_air_date;
                                        var movieDate = new Date(movieDateStr);

                                        if (movieDate <= new Date()) {
                                            movieItem.kinorium_id = String(m.id);
                                            movieItem.source = "tmdb";
                                            kinoriumMovies = Lampa.Storage.get('kinorium_movies', []);
                                            kinoriumMovies.unshift(movieItem);
                                            Lampa.Storage.set('kinorium_movies', JSON.stringify(kinoriumMovies));
                                        } else {
                                            if (Lampa.Storage.get('kinorium_add_to_favorites', false)) {
                                                Lampa.Favorite.add('wath', movieItem, 100);
                                            }
                                        }
                                    }
                                    calculateProgress(receivedMoviesCount, processedItems++);
                                }, function() {
                                    calculateProgress(receivedMoviesCount, processedItems++);
                                });
                            }
                        } else {
                            calculateProgress(receivedMoviesCount, processedItems++);
                        }
                    }, function() {
                        calculateProgress(receivedMoviesCount, processedItems++);
                    });
                } else {
                    console.log('Kinorium', 'Movie already in storage: ' + String(m.id));
                    calculateProgress(receivedMoviesCount, processedItems++);
                }
            });
            
        } catch (error) {
            Lampa.Noty.show('Ошибка при обработке данных Кинориума');
            console.log('Kinorium', 'Process data error:', error);
        }
    }

    function getKinoriumData() {
        var userId = Lampa.Storage.get('kinorium_user_id', '');
        
        if (!userId) {
            requestKinoriumUserId(getKinoriumData);
            return;
        }
        
        console.log('Kinorium', 'Fetching data for user:', userId);
        
        // Используем Google Apps Script как прокси (аналогично плагину Кинопоиска)
        var googleScriptUrl = 'https://script.google.com/macros/s/AKfycbwQhxl9xQPv46uChWJ1UDg6BjSmefbSlTRUoSZz5f1rZDRvdhAGTi6RHyXwcSeyBtPr/exec?kinorium=' + userId;
        
        network.silent(googleScriptUrl, function(html) {
            if (html && html.length > 1000) {
                processKinoriumData(html);
            } else {
                Lampa.Noty.show('Не удалось получить данные с Кинориума через Google Script');
                console.log('Kinorium', 'Invalid HTML received from Google Script');
            }
        }, function(error) {
            Lampa.Noty.show('Ошибка при получении данных через Google Script');
            console.log('Kinorium', 'Google Script error:', error);
            
            // Если Google Script не работает, пробуем альтернативные методы
            tryAlternativeMethods(userId);
        });
    }

    function tryAlternativeMethods(userId) {
        console.log('Kinorium', 'Trying alternative methods for user:', userId);
        
        // Альтернативные методы получения данных
        var alternativeUrls = [
            'https://corsproxy.io/?' + encodeURIComponent('https://ru.kinorium.com/user/' + userId + '/watchlist/'),
            'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://ru.kinorium.com/user/' + userId + '/watchlist/'),
            'https://cors-anywhere.herokuapp.com/https://ru.kinorium.com/user/' + userId + '/watchlist/'
        ];
        
        function tryNextAlternative(index) {
            if (index >= alternativeUrls.length) {
                Lampa.Noty.show('Все методы получения данных не сработали');
                return;
            }
            
            var url = alternativeUrls[index];
            console.log('Kinorium', 'Trying alternative URL:', index, url);
            
            network.silent(url, function(html) {
                if (html && html.length > 1000) {
                    processKinoriumData(html);
                } else {
                    tryNextAlternative(index + 1);
                }
            }, function(error) {
                console.log('Kinorium', 'Alternative URL failed:', index, error);
                tryNextAlternative(index + 1);
            });
        }
        
        tryNextAlternative(0);
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
    
    var Api = {
        full: full,
        clear: clear
    };

    function component(object) {
        var comp = new Lampa.InteractionCategory(object);
        comp.create = function() {
            Api.full(object, this.build.bind(this), this.empty.bind(this));
        };
        comp.nextPageReuest = function(object, resolve, reject) {
            Api.full(object, resolve.bind(comp), reject.bind(comp));
        };
        return comp;
    }

    function startPlugin() {
        var manifest = {
            type: 'video',
            version: '0.4.0',
            name: 'Кинориум',
            description: '',
            component: 'kinorium'
        };
        
        Lampa.Manifest.plugins.push(manifest);
        Lampa.Component.add('kinorium', component);

        function addMenuButton() {
            var button = $("<li class=\"menu__item selector\">\n            <div class=\"menu__ico\">\n                <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n                    <path d=\"M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z\"/>\n                </svg>\n            </div>\n            <div class=\"menu__text\">".concat(manifest.name, "</div>\n        </li>"));
            
            button.on('hover:enter', function() {
                Lampa.Activity.push({
                    url: '',
                    title: manifest.name,
                    component: 'kinorium',
                    page: 1
                });
            });
            
            $('.menu .menu__list').eq(0).append(button);
        }

        if(window.appready) addMenuButton();
        else {
            Lampa.Listener.follow('app', function(e) {
                if(e.type == 'ready') addMenuButton();
            });
        }

        // НАСТРОЙКИ
        if(!window.lampa_settings.kinorium) {
            Lampa.SettingsApi.addComponent({
                component: 'kinorium',
                icon: '<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z\"/></svg>',
                name: 'Кинориум'
            });
        }

        Lampa.SettingsApi.addParam({
            component: 'kinorium',
            param: {
                type: 'title'
            },
            field: {
                name: 'Аккаунт',
            }
        });

        // Показываем текущий ID пользователя
        var currentUserId = Lampa.Storage.get('kinorium_user_id', '');
        Lampa.SettingsApi.addParam({
            component: 'kinorium',
            param: {
                type: 'button',
                name: 'kinorium_set_user_id'
            },
            field: {
                name: currentUserId ? 'ID: ' + currentUserId : 'Указать ID пользователя',
                description: 'Установить ID пользователя Кинориума'
            },
            onChange: () => {
                requestKinoriumUserId(function() {
                    // Обновляем отображение ID в настройках
                    Lampa.Controller.toggle('settings_component');
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
                name: 'kinorium_update'
            },
            field: {
                name: 'Обновить список',
            },
            onChange: () => {
                getKinoriumData();
                Lampa.Noty.show('Обновление списка начато');
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
                description: 'Необходимо при возникновении проблем34'
            },
            onChange: () => {
                Lampa.Storage.set('kinorium_movies', []);
                Lampa.Noty.show('Кэш Кинориума очищен');
            }
        });
    }
    
    if(!window.kinorium_ready) {
        window.kinorium_ready = true;
        startPlugin();
    }
})();