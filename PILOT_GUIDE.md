# Onboard a business in under ten minutes

1. **Sign in (1 minute).** Open https://queuezero.conchportal.com and create a business account. Customers do not need accounts.
2. **Set up (2 minutes).** Enter the business name, industry, country, reporting timezone, and first location/address. Confirm the timezone matches the service location.
3. **Create a queue (1 minute).** Choose a service name, location, typical service duration, notification threshold, and phone collection setting. Keep optional phone collection off unless the business needs it.
4. **Print the QR (2 minutes).** Open the queue's QR section, download PNG or print the sheet, and scan the printed code on a phone. Check the business/service and URL.
5. **Operate (2 minutes).** Keep the staff console open on a laptop or tablet. Have two phones join. Press Call Next, then Complete service. The next call is available only after the current ticket ends. Use Recall if needed; No-show keeps an audit record.
6. **Check recovery (1 minute).** Pause and resume the queue. Temporarily disconnect a phone, reconnect, and check its position. Enable alerts where the browser supports them.
7. **Start small (1 minute).** Begin with one business and 20–50 actual joins. Keep a staff member watching the console; help customers who cannot use a phone. Keep a simple manual fallback if connectivity fails.

## Practical controls

- **Staff:** create their account first. An owner/admin can add them by email under Team and assign queues. Staff cannot access billing or other businesses.
- **Locations:** use Locations to add/edit branches. An inactive location stops new joins without erasing ticket history.
- **Waiting-room screen:** open the display link from queue details. It shows ticket numbers only, never customer names or phones.
- **Customer:** keep the private ticket link, enable alerts, and return near the service area as the turn approaches. Sharing the ticket link shares access to that ticket.
- **Billing:** Free supports 3 queues, Starter 10 and Business 50. Paid checkout is disabled until provider plans are configured. A downgrade preserves existing queues but blocks creation beyond the plan limit.
- **Demo:** /demo contains fictional sample data and an isolated interactive console. It never operates a real queue.

## Measure after the pilot

Review joins, completed visits, average wait/service time, no-shows, cancellation rate, busy hours, notification failures, staff feedback and willingness to pay. Verify customer expectations before adding new scope.

Production configuration and physical-device checks are listed in PRODUCTION_CHECKLIST.md. The checked-in SQL seed is for an empty local development database only.
