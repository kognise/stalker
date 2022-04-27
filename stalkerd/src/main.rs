#![feature(never_type)]
#![feature(try_blocks)]

mod input;
mod processes;

use std::thread::sleep;
use std::time::Duration;

use reqwest::blocking::Client as HttpClient;
use serde::Serialize;
use sysinfo::System;
use sysinfo::SystemExt;
use urlencoding::encode;

use crate::input::last_input_tick;
use crate::processes::collect_processes;

#[derive(Serialize)]
struct List<'a> {
    list: Vec<&'a str>,
}

fn main() {
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
                http.post("http://localhost:3000/ping/desktop")
                    .bearer_auth("uwu")
                    .send()?;

                // Update process list:
                let apps = collect_processes(&mut system);
                let apps_empty = apps.is_empty();
                if !(apps_empty && last_apps_empty) {
                    http.post(format!(
                        "http://localhost:3000/list/apps/{}",
                        encode(&hostname)
                    ))
                    .bearer_auth("uwu")
                    .json(&List { list: apps })
                    .send()?;
                }
                last_apps_empty = apps_empty;

                delay = Duration::from_secs(60);
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
