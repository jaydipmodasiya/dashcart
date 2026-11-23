package dashcart;

import dashcart.Models.*;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.YearMonth;
import java.util.*;

/**
 * All business logic lives here: catalog, users, pricing, payments, orders.
 * Every public method is synchronized, so two customers can never buy the last item at once.
 * Users, orders and stock are saved to a file so data survives a restart.
 */
public final class Store {

    // ------------------------------------------------------------ business rules
    public static final int FREE_DELIVERY_ABOVE = 4999;  // Rs. (furniture is bulky)
    public static final int DELIVERY_FEE = 199;
    public static final int HANDLING_FEE = 99;        // assembly & handling
    public static final int EMI_MIN_ORDER = 5000;
    public static final double EMI_RATE_PA = 13.0;       // % per year
    public static final int[] EMI_MONTHS = {3, 6, 9, 12};
    public static final int MAX_QTY_PER_ITEM = 5;

    private static final SecureRandom RANDOM = new SecureRandom();

    /** Everything that is saved to disk. */
    private static final class Data implements Serializable {
        final Map<String, User> usersByEmail = new HashMap<>();
        final List<Order> orders = new ArrayList<>();
        final Map<String, Integer> stock = new HashMap<>();
        int orderSeq = 1000;
    }

    private final Map<String, Retailer> retailers = new LinkedHashMap<>();
    private final Map<String, Product> products = new LinkedHashMap<>();
    private final Map<String, String> sessions = new HashMap<>(); // token -> userId
    private final Path dbFile;
    private Data data;

    public Store(Path dbFile) {
        this.dbFile = dbFile;
        seedCatalog();
        load();
    }

    // ------------------------------------------------------------ catalog
    private void seedCatalog() {
        // Retailers = furniture showrooms that fulfil orders directly
        retailer("r1", "Urban Sofa Studio", "🛋️", 1.0, 4.6, "Sofas, sectionals & recliners");
        retailer("r2", "Sleep Well Beds", "🛏️", 1.8, 4.7, "Beds, trundle & canopy beds");
        retailer("r3", "WoodCraft Tables", "🪵", 2.3, 4.5, "Dining, coffee & study tables");
        retailer("r4", "SeatWorks Chairs", "🪑", 2.9, 4.4, "Dining, office & accent chairs");
        retailer("r5", "Comfy Corners", "🏠", 3.3, 4.6, "Footstools, ottomans & benches");
        retailer("r6", "StepSmart Storage", "👟", 3.8, 4.3, "Shoe racks & cabinets");

        String sofa = "Sofas", bed = "Beds", tab = "Tables", chr = "Chairs",
               stl = "Stools & Benches", shoe = "Shoe Racks";

        // product(id, name, category, icon, colour, description, MRP, selling price, retailer)
        product("p01", "Nordic 3-Seater Sofa", sofa, "sofa", "#7f9487", "3 seater · Fabric · 210 cm", 32999, 24999, "r1");
        product("p02", "Compact 2-Seater Sofa", sofa, "sofa2", "#c9a67a", "2 seater · Fabric · 150 cm", 18999, 14999, "r1");
        product("p03", "L-Shape Corner Sofa", sofa, "lsofa", "#3d5a80", "5 seater · Sectional · 270 cm", 54999, 42999, "r1");
        product("p04", "Recliner Single Seater", sofa, "armchair", "#6b4f3a", "1 seater · Leatherette", 15999, 11999, "r1");
        product("p05", "Sofa Cum Bed", sofa, "sofa", "#8d8f94", "3 seater · Converts to bed", 28999, 22999, "r1");

        product("p06", "Queen Platform Bed", bed, "bed", "#b07d4f", "Queen · Sheesham wood", 29999, 22999, "r2");
        product("p07", "King Storage Bed", bed, "bed", "#6f4e37", "King · Hydraulic storage", 44999, 35999, "r2");
        product("p08", "Single Bed", bed, "bed", "#d2b48c", "Single · Engineered wood", 14999, 10999, "r2");
        product("p09", "Pull-out Trundle Bed", bed, "trundle", "#a9825a", "Twin · Pull-out for guests", 24999, 18999, "r2");
        product("p10", "Four-Poster Canopy Bed", bed, "canopy", "#5a3e2b", "Queen · Solid wood", 38999, 29999, "r2");
        product("p11", "Kids Trundle Bed with Drawers", bed, "trundle", "#4f8a8b", "Single + trundle · 2 drawers", 19999, 15499, "r2");

        product("p12", "4-Seater Dining Table", tab, "dining", "#a47148", "Sheesham · 120 cm", 21999, 16999, "r3");
        product("p13", "6-Seater Dining Table", tab, "dining", "#7b5233", "Sheesham · 180 cm", 32999, 25999, "r3");
        product("p14", "Round Coffee Table", tab, "coffee", "#c19a6b", "Centre table · 80 cm", 8999, 6499, "r3");
        product("p15", "Study Table with Shelf", tab, "desk", "#8c6a4a", "120 cm · Engineered wood", 9999, 7499, "r3");
        product("p16", "Side / Bedside Table", tab, "sidetable", "#c9a77c", "45 cm · With drawer", 3999, 2999, "r3");

        product("p17", "Dining Chairs (Set of 2)", chr, "chair", "#8c5e3c", "Cushioned seat · Wood", 6999, 4999, "r4");
        product("p18", "Ergonomic Office Chair", chr, "officechair", "#2f3640", "Mesh back · Adjustable", 11999, 8999, "r4");
        product("p19", "Accent Armchair", chr, "armchair", "#d98c5f", "Velvet · Wooden legs", 14999, 10999, "r4");
        product("p20", "Rocking Chair", chr, "rocker", "#9c6b43", "Solid wood · Cushioned", 12999, 9999, "r4");

        product("p21", "Round Footstool", stl, "footstool", "#c97b63", "Velvet · 40 cm", 2999, 1999, "r5");
        product("p22", "Storage Ottoman Bench", stl, "bench", "#4a6fa5", "Lift-up storage · 100 cm", 7999, 5499, "r5");
        product("p23", "Pouf Ottoman", stl, "pouf", "#b5651d", "Handwoven · 45 cm", 3499, 2499, "r5");
        product("p24", "Entryway Bench", stl, "bench", "#8a7560", "Wood + cushion · 90 cm", 6999, 4999, "r5");
        product("p25", "Wooden Footstool", stl, "footstool", "#a47148", "Sheesham · 35 cm", 2499, 1799, "r5");

        product("p26", "3-Tier Shoe Rack", shoe, "shoerack", "#8c6a4a", "9 pairs · Wood", 3499, 2499, "r6");
        product("p27", "5-Tier Shoe Cabinet", shoe, "shoecabinet", "#d8d2c4", "20 pairs · Flip doors", 8999, 6499, "r6");
        product("p28", "Shoe Rack with Seat", shoe, "shoecabinet", "#5b4636", "12 pairs · Cushion seat", 7499, 5499, "r6");
        product("p29", "Slim Metal Shoe Rack", shoe, "shoerack", "#3b3f45", "6 pairs · Steel", 2999, 2199, "r6");
    }

    private void retailer(String id, String name, String emoji, double km, double rating, String tagline) {
        retailers.put(id, new Retailer(id, name, emoji, km, rating, tagline));
    }

    private void product(String id, String name, String cat, String icon, String color, String spec,
                         int mrp, int price, String retailerId) {
        products.put(id, new Product(id, name, cat, icon, color, spec, mrp, price, retailerId));
    }

    public synchronized Map<String, Object> catalog() {
        List<Object> rs = new ArrayList<>();
        for (Retailer r : retailers.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.id()); m.put("name", r.name()); m.put("emoji", r.emoji());
            m.put("distanceKm", r.distanceKm()); m.put("rating", r.rating()); m.put("tagline", r.tagline());
            rs.add(m);
        }
        List<Object> ps = new ArrayList<>();
        LinkedHashSet<String> cats = new LinkedHashSet<>();
        for (Product p : products.values()) {
            cats.add(p.category());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.id()); m.put("name", p.name()); m.put("category", p.category());
            m.put("icon", p.icon()); m.put("color", p.color()); m.put("spec", p.spec()); m.put("mrp", p.mrp());
            m.put("price", p.price()); m.put("retailerId", p.retailerId());
            m.put("stock", data.stock.getOrDefault(p.id(), 0));
            ps.add(m);
        }
        Map<String, Object> rules = new LinkedHashMap<>();
        rules.put("freeDeliveryAbove", FREE_DELIVERY_ABOVE);
        rules.put("deliveryFee", DELIVERY_FEE);
        rules.put("handlingFee", HANDLING_FEE);
        rules.put("emiMinOrder", EMI_MIN_ORDER);
        rules.put("emiRate", EMI_RATE_PA);
        rules.put("maxQty", MAX_QTY_PER_ITEM);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("retailers", rs);
        out.put("categories", new ArrayList<>(cats));
        out.put("products", ps);
        out.put("rules", rules);
        return out;
    }

    // ------------------------------------------------------------ users & sessions
    public synchronized Map<String, Object> register(String name, String email, String password) {
        name = clean(name);
        email = clean(email).toLowerCase();
        if (name.length() < 2) throw bad("Please enter your name");
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw bad("Please enter a valid email");
        if (password == null || password.length() < 6) throw bad("Password must be at least 6 characters");
        if (data.usersByEmail.containsKey(email)) throw new ApiException(409, "This email is already registered");

        String salt = randomHex(8);
        User u = new User("u" + (data.usersByEmail.size() + 1) + randomHex(3), name, email, salt, hash(password, salt));
        data.usersByEmail.put(email, u);
        save();
        return session(u);
    }

    public synchronized Map<String, Object> login(String email, String password) {
        User u = data.usersByEmail.get(clean(email).toLowerCase());
        if (u == null || password == null || !u.hash.equals(hash(password, u.salt)))
            throw new ApiException(401, "Wrong email or password");
        return session(u);
    }

    private Map<String, Object> session(User u) {
        String token = randomHex(24);
        sessions.put(token, u.id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("token", token);
        out.put("user", userMap(u));
        return out;
    }

    public synchronized User userForToken(String token) {
        String id = token == null ? null : sessions.get(token);
        if (id == null) return null;
        for (User u : data.usersByEmail.values()) if (u.id.equals(id)) return u;
        return null;
    }

    public static Map<String, Object> userMap(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.id); m.put("name", u.name); m.put("email", u.email);
        return m;
    }

    // ------------------------------------------------------------ pricing (always done on the server)
    /** Prices the cart using the real database prices - the browser's numbers are never trusted. */
    public synchronized Map<String, Object> quote(List<Object> rawItems) {
        Priced p = price(rawItems);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", itemMaps(p.items));
        out.put("subtotal", p.subtotal);
        out.put("deliveryFee", p.deliveryFee);
        out.put("handlingFee", p.handlingFee);
        out.put("total", p.total);
        out.put("etaMins", p.etaMins);
        out.put("emiEligible", p.total >= EMI_MIN_ORDER);
        out.put("emiPlans", p.total >= EMI_MIN_ORDER ? emiPlans(p.total) : List.of());
        return out;
    }

    private record Priced(List<OrderItem> items, int subtotal, int deliveryFee, int handlingFee, int total, int etaMins) {}

    private Priced price(List<Object> rawItems) {
        if (rawItems == null || rawItems.isEmpty()) throw bad("Your cart is empty");
        if (rawItems.size() > 30) throw bad("Too many different items in the cart");

        Map<String, Integer> wanted = new LinkedHashMap<>();
        for (Object o : rawItems) {
            if (!(o instanceof Map<?, ?> m)) throw bad("Invalid cart");
            String id = String.valueOf(m.get("productId"));
            int qty = m.get("qty") instanceof Number n ? n.intValue() : 0;
            if (!products.containsKey(id)) throw bad("An item in your cart no longer exists");
            if (qty < 1 || qty > MAX_QTY_PER_ITEM) throw bad("Quantity must be between 1 and " + MAX_QTY_PER_ITEM);
            wanted.merge(id, qty, Integer::sum);
        }

        List<OrderItem> items = new ArrayList<>();
        int subtotal = 0;
        double farthest = 0;
        for (Map.Entry<String, Integer> e : wanted.entrySet()) {
            Product p = products.get(e.getKey());
            int qty = Math.min(e.getValue(), MAX_QTY_PER_ITEM);
            int inStock = data.stock.getOrDefault(p.id(), 0);
            if (inStock < qty)
                throw new ApiException(409, inStock == 0 ? p.name() + " is out of stock"
                        : "Only " + inStock + " left of " + p.name());
            Retailer r = retailers.get(p.retailerId());
            items.add(new OrderItem(p.id(), p.name(), p.icon(), p.color(), qty, p.price(), r.id(), r.name()));
            subtotal += p.price() * qty;
            farthest = Math.max(farthest, r.distanceKm());
        }
        int delivery = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
        int total = subtotal + delivery + HANDLING_FEE;
        // Delivery promise: always between 30 and 40 minutes, longer when a shop is further away.
        int eta = Math.max(30, Math.min(40, 30 + (int) Math.round(farthest * 2.5)));
        return new Priced(items, subtotal, delivery, HANDLING_FEE, total, eta);
    }

    // ------------------------------------------------------------ EMI
    /** Reducing-balance EMI:  P * r * (1+r)^n / ((1+r)^n - 1)  with r = annual rate / 12. */
    public static int emiAmount(int principal, int months) {
        double r = EMI_RATE_PA / 12 / 100;
        double f = Math.pow(1 + r, months);
        return (int) Math.round(principal * r * f / (f - 1));
    }

    private static List<Object> emiPlans(int total) {
        List<Object> plans = new ArrayList<>();
        for (int m : EMI_MONTHS) {
            int emi = emiAmount(total, m);
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("months", m);
            p.put("monthly", emi);
            p.put("interest", emi * m - total);
            p.put("payable", emi * m);
            plans.add(p);
        }
        return plans;
    }

    // ------------------------------------------------------------ orders
    public synchronized Map<String, Object> placeOrder(User user, List<Object> rawItems,
                                                        Map<String, Object> addr, Map<String, Object> pay, double speed) {
        Address address = validateAddress(addr);
        Priced priced = price(rawItems);                       // 1. re-price + stock check
        Payment payment = processPayment(pay, priced.total);   // 2. take (mock) payment

        for (OrderItem i : priced.items)                       // 3. reserve stock
            data.stock.merge(i.productId(), -i.qty(), Integer::sum);

        Order order = new Order("DC" + (++data.orderSeq), user.id, priced.items, priced.subtotal,
                priced.deliveryFee, priced.handlingFee, priced.total, priced.etaMins,
                address, payment, System.currentTimeMillis());
        data.orders.add(order);
        save();
        return orderMap(order, speed);
    }

    public synchronized List<Object> ordersFor(User user, double speed) {
        List<Object> out = new ArrayList<>();
        for (int i = data.orders.size() - 1; i >= 0; i--) {
            Order o = data.orders.get(i);
            if (o.userId.equals(user.id)) out.add(orderMap(o, speed));
        }
        return out;
    }

    public synchronized Map<String, Object> orderFor(User user, String id, double speed) {
        for (Order o : data.orders)
            if (o.id.equals(id) && o.userId.equals(user.id)) return orderMap(o, speed);
        throw new ApiException(404, "Order not found");
    }

    private static final String[] STAGES = {"Order confirmed", "Showroom preparing your order", "Out for delivery", "Delivered"};
    private static final double[] STAGE_START = {0.0, 0.15, 0.45, 1.0};   // fraction of the ETA

    /** Order status is calculated from the clock, so no background thread is needed. */
    private Map<String, Object> orderMap(Order o, double speed) {
        double elapsedMins = (System.currentTimeMillis() - o.placedAt) / 60000.0 * speed;
        double progress = elapsedMins / o.etaMins;
        int stage = 0;
        for (int i = 0; i < STAGE_START.length; i++) if (progress >= STAGE_START[i]) stage = i;
        int minsLeft = stage == 3 ? 0 : (int) Math.max(1, Math.ceil(o.etaMins - elapsedMins));

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", o.id);
        m.put("placedAt", o.placedAt);
        m.put("items", itemMaps(o.items));
        m.put("subtotal", o.subtotal);
        m.put("deliveryFee", o.deliveryFee);
        m.put("handlingFee", o.handlingFee);
        m.put("total", o.total);
        m.put("etaMins", o.etaMins);
        m.put("minsLeft", minsLeft);
        m.put("stage", stage);
        m.put("stageLabel", STAGES[stage]);
        m.put("stages", List.of(STAGES));
        m.put("address", Map.of("name", o.address.name(), "phone", o.address.phone(), "line", o.address.line(),
                "city", o.address.city(), "pincode", o.address.pincode()));
        Map<String, Object> pm = new LinkedHashMap<>();
        pm.put("method", o.payment.method());
        pm.put("label", o.payment.label());
        pm.put("ref", o.payment.ref());
        pm.put("emiMonths", o.payment.emiMonths());
        pm.put("emiAmount", o.payment.emiAmount());
        m.put("payment", pm);
        return m;
    }

    private static List<Object> itemMaps(List<OrderItem> items) {
        List<Object> out = new ArrayList<>();
        for (OrderItem i : items) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("productId", i.productId()); m.put("name", i.name());
            m.put("icon", i.icon()); m.put("color", i.color());
            m.put("qty", i.qty()); m.put("price", i.price());
            m.put("retailerId", i.retailerId()); m.put("retailerName", i.retailerName());
            out.add(m);
        }
        return out;
    }

    // ------------------------------------------------------------ validation & payment
    private Address validateAddress(Map<String, Object> a) {
        if (a == null) throw bad("Please enter a delivery address");
        String name = clean(a.get("name")), phone = clean(a.get("phone")), line = clean(a.get("line")),
               city = clean(a.get("city")), pin = clean(a.get("pincode"));
        if (name.length() < 2) throw bad("Enter the receiver's name");
        if (!phone.matches("^[6-9]\\d{9}$")) throw bad("Enter a valid 10-digit mobile number");
        if (line.length() < 5) throw bad("Enter your full address (flat, street, landmark)");
        if (city.length() < 2) throw bad("Enter your city");
        if (!pin.matches("^\\d{6}$")) throw bad("Enter a valid 6-digit pincode");
        return new Address(name, phone, line, city, pin);
    }

    /**
     * Demo payment gateway. It validates the details like a real checkout would,
     * but no money moves. Card number 4000 0000 0000 0002 is always "declined" for demos.
     */
    private Payment processPayment(Map<String, Object> p, int total) {
        if (p == null) throw bad("Please choose a payment method");
        String method = clean(p.get("method"));
        String label;
        int emiMonths = 0, emiAmt = 0;

        switch (method) {
            case "gpay", "paytm" -> {
                String id = clean(p.get("upi"));
                boolean upi = id.matches("^[\\w.\\-]{2,}@[A-Za-z]{2,}$");
                boolean mobile = id.matches("^[6-9]\\d{9}$");
                if (!(upi || (method.equals("paytm") && mobile)))
                    throw bad(method.equals("gpay") ? "Enter a valid UPI ID (example: name@okhdfcbank)"
                            : "Enter a valid UPI ID or Paytm mobile number");
                label = (method.equals("gpay") ? "Google Pay · " : "Paytm · ") + id;
            }
            case "debit", "credit", "emi" -> {
                String num = clean(p.get("cardNumber")).replaceAll("[\\s-]", "");
                String exp = clean(p.get("expiry"));
                String cvv = clean(p.get("cvv"));
                if (clean(p.get("cardName")).length() < 2) throw bad("Enter the name on the card");
                if (!num.matches("^\\d{13,19}$") || !luhn(num)) throw bad("That card number is not valid");
                if (!validExpiry(exp)) throw bad("Card expiry is invalid or in the past (use MM/YY)");
                if (!cvv.matches("^\\d{3,4}$")) throw bad("Enter the 3 or 4 digit CVV");
                if (num.equals("4000000000000002")) throw new ApiException(402, "Payment declined by the bank (demo card)");
                String last4 = num.substring(num.length() - 4);
                if (method.equals("emi")) {
                    if (total < EMI_MIN_ORDER) throw bad("EMI is available on orders of Rs." + EMI_MIN_ORDER + " and above");
                    int months = emiMonths_(p);
                    if (Arrays.stream(EMI_MONTHS).noneMatch(x -> x == months))
                        throw bad("Please choose an EMI plan");
                    emiMonths = months;
                    emiAmt = emiAmount(total, months);
                    label = "EMI " + emiMonths + " months · Credit card ending " + last4;
                } else {
                    label = (method.equals("debit") ? "Debit card" : "Credit card") + " ending " + last4;
                }
            }
            default -> throw bad("Please choose a payment method");
        }
        return new Payment(method, label, "PAY-" + randomHex(5).toUpperCase(), emiMonths, emiAmt);
    }

    private static int emiMonths_(Map<String, Object> p) {
        return p.get("emiMonths") instanceof Number n ? n.intValue() : 0;
    }

    private static boolean luhn(String number) {
        int sum = 0;
        boolean dbl = false;
        for (int i = number.length() - 1; i >= 0; i--) {
            int d = number.charAt(i) - '0';
            if (dbl) { d *= 2; if (d > 9) d -= 9; }
            sum += d;
            dbl = !dbl;
        }
        return sum % 10 == 0;
    }

    private static boolean validExpiry(String exp) {
        if (!exp.matches("^(0[1-9]|1[0-2])/\\d{2}$")) return false;
        int month = Integer.parseInt(exp.substring(0, 2));
        int year = 2000 + Integer.parseInt(exp.substring(3));
        return !YearMonth.of(year, month).isBefore(YearMonth.now());
    }

    // ------------------------------------------------------------ helpers
    private static ApiException bad(String message) { return new ApiException(400, message); }

    private static String clean(Object o) { return o == null ? "" : String.valueOf(o).trim(); }

    private static String randomHex(int bytes) {
        byte[] b = new byte[bytes];
        RANDOM.nextBytes(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private static String hash(String password, String salt) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest((salt + password).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte x : d) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // ------------------------------------------------------------ persistence (simple file storage)
    private void load() {
        if (Files.exists(dbFile)) {
            try (ObjectInputStream in = new ObjectInputStream(Files.newInputStream(dbFile))) {
                data = (Data) in.readObject();
            } catch (Exception e) {
                System.out.println("Could not read " + dbFile + " (" + e.getMessage() + ") - starting fresh.");
            }
        }
        if (data == null) data = new Data();
        for (Product p : products.values()) {   // first run: stock up the shelves
            data.stock.putIfAbsent(p.id(), p.price() >= 30000 ? 5 : 10);   // big pieces: fewer in stock
        }
        save();
    }

    private void save() {
        try {
            Files.createDirectories(dbFile.toAbsolutePath().getParent());
            try (ObjectOutputStream out = new ObjectOutputStream(Files.newOutputStream(dbFile))) {
                out.writeObject(data);
            }
        } catch (IOException e) {
            System.out.println("Warning: could not save data: " + e.getMessage());
        }
    }
}
