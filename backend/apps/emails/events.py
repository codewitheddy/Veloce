"""
Event Registry & Constants for Transactional Emails.
"""

# Order Lifecycle Events
ORDER_PLACED_CUSTOMER = 'order.placed.customer'
ORDER_PLACED_ADMIN = 'order.placed.admin'
ORDER_SHIPPED_CUSTOMER = 'order.shipped.customer'
ORDER_DELIVERED_CUSTOMER = 'order.delivered.customer'
ORDER_CANCELLED_CUSTOMER = 'order.cancelled.customer'
PAYMENT_FAILED_CUSTOMER = 'payment.failed.customer'

# Contact & Support Events
CONTACT_SUBMITTED_ADMIN = 'contact.submitted.admin'
CONTACT_SUBMITTED_CUSTOMER = 'contact.submitted.customer'

# User Account Events
USER_WELCOME_CUSTOMER = 'user.welcome.customer'
USER_PASSWORD_RESET = 'user.password_reset.customer'

# Marketing / Lifecycle Stubs
ABANDONED_CART_REMINDER = 'marketing.abandoned_cart.customer'

EVENT_CHOICES = [
    (ORDER_PLACED_CUSTOMER, 'Order Placed (Customer Confirmation)'),
    (ORDER_PLACED_ADMIN, 'Order Placed (Admin Alert)'),
    (ORDER_SHIPPED_CUSTOMER, 'Order Shipped (Customer Notice)'),
    (ORDER_DELIVERED_CUSTOMER, 'Order Delivered (Customer Notice)'),
    (ORDER_CANCELLED_CUSTOMER, 'Order Cancelled (Customer Notice)'),
    (PAYMENT_FAILED_CUSTOMER, 'Payment Failed (Customer Alert)'),
    (CONTACT_SUBMITTED_ADMIN, 'Contact Inquiry (Admin Notification)'),
    (CONTACT_SUBMITTED_CUSTOMER, 'Contact Acknowledgment (Customer Auto-Reply)'),
    (USER_WELCOME_CUSTOMER, 'User Welcome (Customer Onboarding)'),
    (USER_PASSWORD_RESET, 'Password Reset (Customer)'),
    (ABANDONED_CART_REMINDER, 'Abandoned Cart Reminder'),
]

# Event to Template Mapping
EVENT_TEMPLATES = {
    ORDER_PLACED_CUSTOMER: {
        'subject_template': "Your Order #{order_short_id} is Confirmed | Veloce Kenya",
        'html_template': 'emails/order_placed_customer.html',
        'text_template': 'emails/order_placed_customer.txt',
    },
    ORDER_PLACED_ADMIN: {
        'subject_template': "🔔 [NEW ORDER] #{order_short_id} - KSh {total_formatted} from {customer_name}",
        'html_template': 'emails/order_placed_admin.html',
        'text_template': 'emails/order_placed_admin.txt',
    },
    ORDER_SHIPPED_CUSTOMER: {
        'subject_template': "Your Package Is On Its Way! - #{order_short_id} | Veloce Kenya",
        'html_template': 'emails/order_shipped_customer.html',
        'text_template': 'emails/order_shipped_customer.txt',
    },
    ORDER_DELIVERED_CUSTOMER: {
        'subject_template': "Order Delivered & Completed - #{order_short_id} | Veloce Kenya",
        'html_template': 'emails/order_delivered_customer.html',
        'text_template': 'emails/order_delivered_customer.txt',
    },
    ORDER_CANCELLED_CUSTOMER: {
        'subject_template': "Order Cancelled - #{order_short_id} | Veloce Kenya",
        'html_template': 'emails/order_cancelled_customer.html',
        'text_template': 'emails/order_cancelled_customer.txt',
    },
    PAYMENT_FAILED_CUSTOMER: {
        'subject_template': "Payment Notice: Order #{order_short_id} | Veloce Kenya",
        'html_template': 'emails/payment_failed_customer.html',
        'text_template': 'emails/payment_failed_customer.txt',
    },
    CONTACT_SUBMITTED_ADMIN: {
        'subject_template': "📩 [Contact Inquiry] {subject_clean} - From {sender_name}",
        'html_template': 'emails/contact_submitted_admin.html',
        'text_template': 'emails/contact_submitted_admin.txt',
    },
    CONTACT_SUBMITTED_CUSTOMER: {
        'subject_template': "We received your message, {sender_name}! | Veloce Support Desk",
        'html_template': 'emails/contact_submitted_customer.html',
        'text_template': 'emails/contact_submitted_customer.txt',
    },
    USER_WELCOME_CUSTOMER: {
        'subject_template': "Welcome to Veloce Kenya, {user_name}! 🌟",
        'html_template': 'emails/user_welcome_customer.html',
        'text_template': 'emails/user_welcome_customer.txt',
    },
}
