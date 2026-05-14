use actix_web::{web, HttpRequest, HttpResponse};
use bcrypt::{hash, verify, DEFAULT_COST};
use diesel::prelude::*;
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use std::env;

use crate::DbPool;
use crate::models::User;
use crate::schema::users;

#[derive(Deserialize)]
pub struct RegisterInput {
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Serialize, Deserialize)]
pub struct Claims {
    pub sub: i32,
    pub exp: usize,
}

#[derive(Deserialize)]
pub struct UpdateInput {
    pub name: Option<String>,
}

pub async fn register(pool: web::Data<DbPool>, body: web::Json<RegisterInput>) -> HttpResponse {
    let mut conn = pool.get().expect("DB connection failed");
    let hashed = hash(&body.password, DEFAULT_COST).unwrap();

    let new_user = (
        users::email.eq(&body.email),
        users::password_hash.eq(&hashed),
        users::name.eq(&body.name),
    );

    let user: User = diesel::insert_into(users::table)
        .values(new_user)
        .get_result(&mut conn)
        .map_err(|_| HttpResponse::Conflict().json(serde_json::json!({"error": "Email already exists"})))
        .unwrap();

    let token = create_token(user.id);
    HttpResponse::Created().json(serde_json::json!({"token": token, "user": user.public()}))
}

pub async fn login(pool: web::Data<DbPool>, body: web::Json<LoginInput>) -> HttpResponse {
    let mut conn = pool.get().expect("DB connection failed");

    let user: User = users::table
        .filter(users::email.eq(&body.email))
        .first(&mut conn)
        .map_err(|_| HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid credentials"})))
        .unwrap();

    if !verify(&body.password, &user.password_hash).unwrap_or(false) {
        return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid credentials"}));
    }

    let token = create_token(user.id);
    HttpResponse::Ok().json(serde_json::json!({"token": token, "user": user.public()}))
}

pub async fn get_me(pool: web::Data<DbPool>, req: HttpRequest) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let mut conn = pool.get().expect("DB connection failed");
    let user: User = users::table.find(user_id).first(&mut conn).unwrap();
    HttpResponse::Ok().json(serde_json::json!({"user": user.public()}))
}

pub async fn update_me(pool: web::Data<DbPool>, req: HttpRequest, body: web::Json<UpdateInput>) -> HttpResponse {
    let user_id = match extract_user_id(&req) {
        Some(id) => id,
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Unauthorized"})),
    };

    let mut conn = pool.get().expect("DB connection failed");

    if let Some(name) = &body.name {
        diesel::update(users::table.find(user_id))
            .set(users::name.eq(name))
            .execute(&mut conn)
            .unwrap();
    }

    let user: User = users::table.find(user_id).first(&mut conn).unwrap();
    HttpResponse::Ok().json(serde_json::json!({"user": user.public()}))
}

fn create_token(user_id: i32) -> String {
    let secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let exp = chrono::Utc::now().timestamp() as usize + 72 * 3600;
    let claims = Claims { sub: user_id, exp };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes())).unwrap()
}

fn extract_user_id(req: &HttpRequest) -> Option<i32> {
    let auth = req.headers().get("Authorization")?.to_str().ok()?;
    let token_str = auth.strip_prefix("Bearer ")?;
    let secret = env::var("JWT_SECRET").ok()?;
    let data = decode::<Claims>(token_str, &DecodingKey::from_secret(secret.as_bytes()), &Validation::default()).ok()?;
    Some(data.claims.sub)
}
