#![feature(never_type)]
#![feature(try_blocks)]

mod input;
mod processes;

use std::fs::File;
use std::thread::sleep;
use std::time::Duration;

use daemonize::Daemonize;
use home::home_dir;
use reqwest::blocking::Client as HttpClient;
use serde::Serialize;
use sysinfo::System;
use sysinfo::SystemExt;
use urlencoding::encode;

use crate::input::last_input_tick;
use crate::processes::collect_processes;

const PASSWORD: &str = include_str!("../.password");

#[derive(Serialize)]
struct List<'a> {
    list: Vec<&'a str>,
}

fn main() {
    let home = home_dir().expect("Failed to get home directory");
    let stdout =
        File::create(home.join(".stalkerd.log")).expect("Failed to open logfile for stdout");
    let stderr = File::options()
        .append(true)
        .open(home.join(".stalkerd.log"))
        .expect("Failed to open logfile for stderr");
    let daemonize = Daemonize::new()
        .pid_file(home.join(".stalkerd.pid"))
        .stdout(stdout)
        .stderr(stderr);

    println!("Starting daemon...");
    match daemonize.start() {
        Ok(_) => println!("Daemon started!"),
        Err(err) => panic!("Error starting daemon: {}", err),
    }

    let mut system = System::default();
    let hostname = system.host_name().expect("No hostname");
    let http = HttpClient::new();

    let mut tick = 0;
    let mut last_apps_empty = false; // To avoid duplicate empty requests

    loop {
        let mut delay = Duration::from_secs(60);

        // My rust-analyzer broke with try_blocks for some reason :(
        let mut go = || -> Result<(), reqwest::Error> {
            let new_tick = last_input_tick();
            if new_tick != tick {
                // Ping backend:
                tick = new_tick;
                http.post("https://api.kognise.dev/ping/desktop")
                    .bearer_auth(PASSWORD)
                    .send()?;

                // Update process list:
                let apps = collect_processes(&mut system);
                let apps_empty = apps.is_empty();
                if !(apps_empty && last_apps_empty) {
                    http.post(format!(
                        "https://api.kognise.dev/list/apps/{}",
                        encode(&hostname)
                    ))
                    .bearer_auth(PASSWORD)
                    .json(&List { list: apps })
                    .send()?;
                }
                last_apps_empty = apps_empty;
            } else {
                delay = Duration::from_secs(10);
            }
            Ok(())
        };

        if let Err(err) = go() {
            eprintln!("{}", err);
            delay = Duration::from_secs(30);
        }
        println!("Next tick in {:?}", delay);
        sleep(delay);
    }
}
