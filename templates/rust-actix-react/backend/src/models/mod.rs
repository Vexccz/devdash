use diesel::prelude::*;
use serde::Serialize;

#[derive(Queryable, Serialize)]
pub struct User {
    pub id: i32,
    pub email: String,
    pub password_hash: String,
    pub name: String,
    pub role: String,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Serialize)]
pub struct PublicUser {
    pub id: i32,
    pub email: String,
    pub name: String,
    pub role: String,
}

impl User {
    pub fn public(&self) -> PublicUser {
        PublicUser {
            id: self.id,
            email: self.email.clone(),
            name: self.name.clone(),
            role: self.role.clone(),
        }
    }
}
