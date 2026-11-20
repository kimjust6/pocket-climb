/**
 * Sanitize search terms to prevent tracking sensitive data, credentials, URLs, or malicious payloads.
 * @param {string} term
 * @returns {string}
 */
function sanitizeSearchTerm(term) {
    if (!term || typeof term !== 'string') return '';
    let clean = term.trim().replace(/<[^>]*>/g, '');
    if (/@|\b(https?|ftp|file):\/\/|password|token|secret/i.test(clean)) {
        return '';
    }
    return clean.slice(0, 100);
}

/**
 * Send an event to Google Analytics 4 Measurement Protocol from the server.
 * @param {string} eventName
 * @param {Object} eventParams
 * @param {Object|null} req
 * @param {Function} [extractCookiesFn]
 */
function trackGAEvent(eventName, eventParams = {}, req = null, extractCookiesFn = null) {
    try {
        const { GA_MEASUREMENT_ID } = require(`${__hooks}/pages/utils/constants.js`);
        const measurementId = GA_MEASUREMENT_ID || 'G-6P8M4DJNQL';

        let clientId = 'pb_server_client';
        if (req && typeof extractCookiesFn === 'function') {
            try {
                const cookies = extractCookiesFn(req);
                if (cookies && cookies._ga) {
                    const gaVal = cookies._ga.value || cookies._ga;
                    const parts = String(gaVal).split('.');
                    if (parts.length >= 4) {
                        clientId = parts.slice(2).join('.');
                    }
                }
            } catch (_) {}
        }

        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}`;
        const payload = {
            client_id: clientId,
            events: [{
                name: eventName,
                params: Object.assign({}, eventParams, {
                    anonymize_ip: true,
                    allow_google_signals: false,
                }),
            }],
        };

        const sendRequest = () => {
            try {
                if (typeof $http !== 'undefined' && $http.send) {
                    $http.send({
                        url,
                        method: 'POST',
                        body: JSON.stringify(payload),
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        timeout: 1,
                    });
                }
            } catch (err) {
                if (typeof $app !== 'undefined' && $app.logger) {
                    $app.logger().error('Failed to send GA event from backend', 'error', err);
                }
            }
        };

        if (typeof setTimeout === 'function') {
            setTimeout(sendRequest, 0);
        } else {
            sendRequest();
        }
    } catch (err) {
        if (typeof $app !== 'undefined' && $app.logger) {
            $app.logger().error('Failed to prepare GA event tracking', 'error', err);
        }
    }
}

module.exports = {
    sanitizeSearchTerm,
    trackGAEvent,
};

