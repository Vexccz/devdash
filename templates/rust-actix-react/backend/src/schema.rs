diesel::table! {
    users (id) {
        id -> Int4,
        email -> Varchar,
        password_hash -> Varchar,
        name -> Varchar,
        role -> Varchar,
        created_at -> Timestamp,
    }
}
