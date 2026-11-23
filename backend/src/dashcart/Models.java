package dashcart;

import java.io.Serializable;
import java.util.List;

/** Plain data classes used across the backend. */
public final class Models {
    private Models() {}

    /** A local shop that fulfils orders directly (the "retailer"). */
    public record Retailer(String id, String name, String emoji, double distanceKm, double rating, String tagline) {}

    /** icon = which drawing the frontend uses (sofa, bed, ...), color = main colour of that drawing. */
    public record Product(String id, String name, String category, String icon, String color, String spec,
                          int mrp, int price, String retailerId) {}

    public record Address(String name, String phone, String line, String city, String pincode)
            implements Serializable {}

    public record OrderItem(String productId, String name, String icon, String color, int qty, int price,
                            String retailerId, String retailerName) implements Serializable {}

    /** Only a masked label is stored - never the full card number or CVV. */
    public record Payment(String method, String label, String ref, int emiMonths, int emiAmount)
            implements Serializable {}

    public static final class User implements Serializable {
        public final String id, name, email, salt, hash;

        public User(String id, String name, String email, String salt, String hash) {
            this.id = id; this.name = name; this.email = email; this.salt = salt; this.hash = hash;
        }
    }

    public static final class Order implements Serializable {
        public final String id, userId;
        public final List<OrderItem> items;
        public final int subtotal, deliveryFee, handlingFee, total, etaMins;
        public final Address address;
        public final Payment payment;
        public final long placedAt;

        public Order(String id, String userId, List<OrderItem> items, int subtotal, int deliveryFee,
                     int handlingFee, int total, int etaMins, Address address, Payment payment, long placedAt) {
            this.id = id; this.userId = userId; this.items = items; this.subtotal = subtotal;
            this.deliveryFee = deliveryFee; this.handlingFee = handlingFee; this.total = total;
            this.etaMins = etaMins; this.address = address; this.payment = payment; this.placedAt = placedAt;
        }
    }

    /** Thrown for any user-facing error; becomes an HTTP error response. */
    public static final class ApiException extends RuntimeException {
        public final int status;

        public ApiException(int status, String message) {
            super(message);
            this.status = status;
        }
    }
}
