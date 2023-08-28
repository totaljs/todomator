# Todomator

![Todomator app](https://todomator.com/img/app.png)

Todomator is a task manager app for small teams up to 30 members (recommended).

- [Website](https://www.totaljs.com/todomator/)
- [__Documentation__](https://docs.totaljs.com/todomator/)
- [Join __Total.js Telegram__](https://t.me/totalplatform)
- [Support](https://www.totaljs.com/support/)

## Installation

WARNING: Please do not execute `database.sql`, this script will use Todomator internally.

__Manual installation__:

- Install latest version of [__Node.js platform__](https://nodejs.org/en/)
- Install PostgreSQL
- [Download __Source-Code__](https://github.com/totaljs/todomator)
- Create a database for the Todomator
- Install NPM dependencies via terminal `$ npm install` in the root of application
- Update connection strings in `/config` file
- Run it `$ node index.js`
- Open `http://127.0.0.1:8000` in your web browser

__Docker Hub__:

```bash
docker pull totalplatform/todomator
docker run --env DATABASE='postgresql://user:pass@hostname/database' -p 8000:8000 totalplatform/todomator
````

__Docker Compose__:

```bash
git clone https://github.com/totaljs/todomator.git
cd todomator
docker compose up
````

## Default credentials

```html
login : info@totaljs.com
password : admin
```

## Premium plugins

Premium plugins are part of the [Total.js Enterprise service](https://www.totaljs.com/enterprise/). Todomator plugins add new functionality to the app.

- extensions (paste rich content, quick open ticket, etc.)
- reminder
- reports
- workload