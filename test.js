(function(){
    var plugin = {};

    plugin.settings = {
        login: {
            name: 'Логин',
            type: 'input',
            default: '',
            placeholder: 'Введите ваш логин'
        },
        token: {
            name: 'Токен',
            type: 'input',
            default: '',
            placeholder: 'API токен'
        }
    };

    plugin.init = function(){
        var login = Lampa.Storage.get('login','');
        var token = Lampa.Storage.get('token','');

        console.log('Логин:', login);
        console.log('Токен:', token);
    };

    Lampa.Plugin.add(plugin);
})();