use actix_cors::Cors;
use actix_web::{web, App, HttpServer, middleware::Logger};
use diesel::r2d2::{self, ConnectionManager};
use diesel::PgConnection;
use dotenvy::dotenv;
use std::env;

mod handlers;
mod middleware;
mod models;
mod schema;

pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<PgConnection>::new(database_url);
    let pool = r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool");

    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let cors_origin = env::var("CORS_ORIGIN").unwrap_or_else(|_| "http://localhost:5173".to_string());

    log::info!("Starting server on port {}", port);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&cors_origin)
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
            .allowed_headers(vec!["Content-Type", "Authorization"])
            .max_age(3600);

        App::new()
            .app_data(web::Data::new(pool.clone()))
            .wrap(cors)
            .wrap(Logger::default())
            .service(
                web::scope("/api")
                    .service(
                        web::scope("/auth")
                            .route("/register", web::post().to(handlers::auth::register))
                            .route("/login", web::post().to(handlers::auth::login)),
                    )
                    .service(
                        web::scope("/me")
                            .route("", web::get().to(handlers::auth::get_me))
                            .route("", web::put().to(handlers::auth::update_me)),
                    ),
            )
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
