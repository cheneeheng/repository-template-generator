use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};

static NEXT_ID: AtomicU32 = AtomicU32::new(1);

#[derive(Serialize)]
pub struct HealthResponse {
    status: &'static str,
}

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

#[derive(Debug, Serialize, Clone)]
pub struct Item {
    pub id: u32,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateItem {
    pub name: String,
}

pub async fn list_items() -> Json<Vec<Item>> {
    Json(vec![])
}

pub async fn get_item(Path(id): Path<u32>) -> impl IntoResponse {
    // Replace with actual data store lookup.
    let _ = id;
    (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "not found"})))
}

pub async fn create_item(Json(payload): Json<CreateItem>) -> impl IntoResponse {
    let item = Item {
        id: NEXT_ID.fetch_add(1, Ordering::SeqCst),
        name: payload.name,
    };
    (StatusCode::CREATED, Json(item))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use axum::{routing::get, Router};
    use tower::ServiceExt;

    fn app() -> Router {
        Router::new().route("/health", get(health))
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let response = app()
            .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}
