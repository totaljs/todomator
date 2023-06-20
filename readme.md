# Todomator

Todomator is a task manager app for small teams up to 30 members (recommended).

- [Website](https://www.totaljs.com/todomator/)
- [__Documentation__](https://docs.totaljs.com/todomator/)
- [Join __Total.js Telegram__](https://t.me/totalplatform)
- [Support](https://www.totaljs.com/support/)

## Installation

There are several ways to provide Todomator. You can use our cloud services and run Todomator without installation, or use Docker, or download the source code locally.

### Locally

- install [Node.js platform](https://nodejs.org/en/)
- download Flow source code
- open terminal/command-line:
	- `cd todomator`
	- `npm install`
	- `npm start`

__Run__:

```
npm run start
```

or directly using node executable (port is optional, default 8000)

```
node index.js <port>
```

### Todomator in Docker

```bash
docker pull totalplatform/todomator
docker run -p 8000:8000 totalplatform/todomator
````
