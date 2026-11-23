package dashcart;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dashcart.Models.ApiException;
import dashcart.Models.User;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.Executors;

/**
 * DashCart - 30-40 minute delivery web app.
 * Uses only the JDK's built-in web server (com.sun.net.httpserver): no frameworks, no libraries.
 *
 * Run:  java -cp out dashcart.Main [port] [frontendFolder] [speed]
 *   speed = 1 (real time). Use e.g. 30 for a demo where 35 minutes pass in about 70 seconds.
 */
public final class Main {

    private final Store store;
    private final Path frontendDir;
    private final double speed;

    private Main(Store store, Path frontendDir, double speed) {
        this.store = store;
        this.frontendDir = frontendDir;
        this.speed = speed;
    }

    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        Path frontend = Path.of(args.length > 1 ? args[1] : "frontend").toAbsolutePath().normalize();
        double speed = args.length > 2 ? Double.parseDouble(args[2]) : 1.0;

        Store store = new Store(Path.of("data", "dashcart.db"));
        Main app = new Main(store, frontend, speed);

        if (!Files.isRegularFile(frontend.resolve("index.html"))) {
            System.out.println("ERROR: cannot find " + frontend.resolve("index.html"));
            System.out.println("Run the app from the project folder (the one that contains the 'frontend' folder).");
            return;
        }

        HttpServer server;
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
        } catch (java.net.BindException e) {
            System.out.println("ERROR: port " + port + " is already in use. Close the other DashCart window, or run:");
            System.out.println("  java -cp backend/out dashcart.Main 9090 frontend");
            return;
        }
        server.createContext("/api/", app::handleApi);
        server.createContext("/", app::handleStatic);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();

        String url = "http://localhost:" + port;
        System.out.println("DashCart is running ->  " + url);
        System.out.println("Frontend folder      ->  " + frontend);
        if (speed != 1.0) System.out.println("DEMO MODE: delivery runs " + speed + "x faster than real time");
        System.out.println("Opening your browser... (press Ctrl+C here to stop the server)");
        try {   // open the browser automatically when the OS allows it
            if (java.awt.Desktop.isDesktopSupported()
                    && java.awt.Desktop.getDesktop().isSupported(java.awt.Desktop.Action.BROWSE))
                java.awt.Desktop.getDesktop().browse(java.net.URI.create(url));
        } catch (Exception | Error ignored) { /* no browser available - open the URL by hand */ }
    }

    // ================================================================ API
    private void handleApi(HttpExchange ex) throws IOException {
        try {
            Object result = route(ex);
            send(ex, 200, "application/json; charset=utf-8", Json.write(result).getBytes(StandardCharsets.UTF_8));
        } catch (ApiException e) {
            sendError(ex, e.status, e.getMessage());
        } catch (IllegalArgumentException e) {
            sendError(ex, 400, "Invalid request: " + e.getMessage());
        } catch (Exception e) {
            e.printStackTrace();
            sendError(ex, 500, "Something went wrong on the server");
        }
    }

    private Object route(HttpExchange ex) throws IOException {
        String method = ex.getRequestMethod();
        String path = ex.getRequestURI().getPath();

        // ---- public routes
        if (method.equals("GET") && path.equals("/api/catalog")) return store.catalog();

        if (method.equals("GET") && path.equals("/api/geocode")) return geocode(ex.getRequestURI().getQuery());

        if (method.equals("POST") && path.equals("/api/quote")) {
            return store.quote(list(body(ex).get("items")));
        }
        if (method.equals("POST") && path.equals("/api/register")) {
            Map<String, Object> b = body(ex);
            return store.register(str(b.get("name")), str(b.get("email")), str(b.get("password")));
        }
        if (method.equals("POST") && path.equals("/api/login")) {
            Map<String, Object> b = body(ex);
            return store.login(str(b.get("email")), str(b.get("password")));
        }

        // ---- routes that need a logged-in user
        User user = currentUser(ex);
        if (method.equals("GET") && path.equals("/api/me")) return Store.userMap(user);

        if (method.equals("POST") && path.equals("/api/orders")) {
            Map<String, Object> b = body(ex);
            return store.placeOrder(user, list(b.get("items")), map(b.get("address")), map(b.get("payment")), speed);
        }
        if (method.equals("GET") && path.equals("/api/orders")) return store.ordersFor(user, speed);

        if (method.equals("GET") && path.startsWith("/api/orders/")) {
            return store.orderFor(user, path.substring("/api/orders/".length()), speed);
        }
        throw new ApiException(404, "Unknown API route");
    }

    /** "Current location": turns the browser's coordinates into an address using OpenStreetMap's free Nominatim service.
     *  If the internet or the service is not available we still answer, just without the address text. */
    private Object geocode(String query) {
        double lat, lon;
        try {
            Map<String, String> q = new HashMap<>();
            for (String part : (query == null ? "" : query).split("&")) {
                String[] kv = part.split("=", 2);
                if (kv.length == 2) q.put(kv[0], URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
            }
            lat = Double.parseDouble(q.get("lat"));
            lon = Double.parseDouble(q.get("lon"));
        } catch (Exception e) {
            throw new ApiException(400, "Send ?lat=..&lon=.. coordinates");
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new ApiException(400, "Coordinates out of range");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("lat", lat);
        out.put("lon", lon);
        try {
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                    .connectTimeout(java.time.Duration.ofSeconds(4)).build();
            java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder(java.net.URI.create(
                            "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=" + lat + "&lon=" + lon))
                    .header("User-Agent", "DashCart-college-project/1.0")
                    .header("Accept-Language", "en")
                    .timeout(java.time.Duration.ofSeconds(6)).GET().build();
            java.net.http.HttpResponse<String> res = client.send(req, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() == 200) {
                Map<String, Object> a = map(map(Json.parse(res.body())).get("address"));
                if (a != null) {
                    String area = firstOf(a, "neighbourhood", "suburb", "quarter", "village");
                    String city = firstOf(a, "city", "town", "municipality", "county", "state_district");
                    String road = firstOf(a, "road", "pedestrian", "residential");
                    String line = String.join(", ", java.util.stream.Stream.of(firstOf(a, "house_number"), road, area)
                            .filter(x -> !x.isEmpty()).toList());
                    out.put("line", line);
                    out.put("area", area);
                    out.put("city", city);
                    out.put("state", firstOf(a, "state"));
                    out.put("pincode", firstOf(a, "postcode").replaceAll("\\D", ""));
                }
            }
        } catch (Exception e) { /* offline or blocked: fall back to coordinates only */ }
        return out;
    }

    private static String firstOf(Map<String, Object> m, String... keys) {
        for (String k : keys) if (m.get(k) != null && !String.valueOf(m.get(k)).isBlank()) return String.valueOf(m.get(k));
        return "";
    }

    private User currentUser(HttpExchange ex) {
        String h = ex.getRequestHeaders().getFirst("Authorization");
        String token = (h != null && h.startsWith("Bearer ")) ? h.substring(7) : null;
        User u = store.userForToken(token);
        if (u == null) throw new ApiException(401, "Please log in first");
        return u;
    }

    // ================================================================ static files (the frontend)
    private void handleStatic(HttpExchange ex) throws IOException {
        String path = URLDecoder.decode(ex.getRequestURI().getPath(), StandardCharsets.UTF_8);
        if (path.equals("/")) path = "/index.html";
        Path file = frontendDir.resolve(path.substring(1)).normalize();

        if (!file.startsWith(frontendDir) || !Files.isRegularFile(file)) {   // blocks ../ tricks
            send(ex, 404, "text/plain; charset=utf-8", "404 - Not found".getBytes(StandardCharsets.UTF_8));
            return;
        }
        send(ex, 200, contentType(file.toString()), Files.readAllBytes(file));
    }

    private static String contentType(String name) {
        if (name.endsWith(".html")) return "text/html; charset=utf-8";
        if (name.endsWith(".css")) return "text/css; charset=utf-8";
        if (name.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (name.endsWith(".json")) return "application/json; charset=utf-8";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".woff2")) return "font/woff2";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    // ================================================================ helpers
    private static Map<String, Object> body(HttpExchange ex) throws IOException {
        String text = new String(ex.getRequestBody().readNBytes(100_000), StandardCharsets.UTF_8);
        if (text.isBlank()) return new LinkedHashMap<>();
        return map(Json.parse(text));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : null;
    }

    @SuppressWarnings("unchecked")
    private static List<Object> list(Object o) {
        return o instanceof List ? (List<Object>) o : null;
    }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o); }

    private static void sendError(HttpExchange ex, int status, String message) throws IOException {
        send(ex, status, "application/json; charset=utf-8",
                Json.write(Map.of("error", message)).getBytes(StandardCharsets.UTF_8));
    }

    private static void send(HttpExchange ex, int status, String type, byte[] bytes) throws IOException {
        ex.getResponseHeaders().set("Content-Type", type);
        ex.getResponseHeaders().set("Cache-Control", "no-store");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }
}
