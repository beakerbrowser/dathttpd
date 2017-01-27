# dathttpd

Host Dat sites over HTTPs and Dat with DNS hostnames and zero-config TLS (via LetsEncrypt).

## Usage

Create a config file at `~/.dathttpd.yml`, then run

```
npm install -g dathttpd
dathttpd start
```

To daemonify the server in Debian-based systems, run

```
npm install -g add-to-systemd
sudo add-to-systemd dathttpd $(which dathttpd) start
sudo systemctl start dathttpd
```

You can jump into the config with your default editor via

```
dathttpd edit
```

Then reload the server via

```
dathttpd reload
```

Or stop it with

```
dathttpd stop
```

## Config

Here's an example `~/.dathttpd.yml`:

```yaml
port: 443
directory: ~/.dathttpd
letsencrypt:
  email: 'bob@foo.com'
  aggreeTos: true
sites:
  datprotocol.myhostname.com:
    url: dat://ff34725120b2f3c5bd5028e4f61d14a45a22af48a7b12126d5d588becde88a93/
    datOnly: false
  portal.myhostname.com:
    url: dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/
    datOnly: true
```

### port

The port to serve the HTTPS sites. Defaults to 443. (Optional)

### directory

The directory to store the site files. Defaults to ~/.dathttpd. (Optional)

### letsencrypt.email

The email to send Lets Encrypt? notices to. (Required)

### letsencrypt.agreeTos

Do you agree to the terms of service of Lets Encrypt? (Required, must be true)

### sites

A listing of the sites to host. Each site is labeled (keyed) by the hostname you want the site to serve at.

You'll need to configure the DNS entry for the hostname to point to the server. For instance, if using `portal.myhostname.com`, you'll need a DNS entry pointing `portal.myhostname.com` to the server.

### sites.{hostname}.url

The Dat URL of the site to host. (Required)

### sites.{hostname}.datOnly

If true, rather than serve the assets over HTTPS, dathttpd will serve a redirect to the dat:// location. Defaults to false. (Optional)

## Env Vars

  - `CONFIG=cfg_file_path` specify an alternative path to the config than `~/.dathttpd.yml`