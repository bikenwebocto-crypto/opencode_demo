describe("Add Multiple Offers Test", () => {
  it("should login as admin and add 3 offers", () => {
    // === LOGIN ===
    cy.visit("localhost:3000/login");
    cy.get('[name="email"]').type("bibek62020@adsprite.com");
    cy.get('[name="password"]').type("bibek@123");
    cy.get("#auth-sign-in button.c-bOcPnF").click();
    cy.wait(10000);
    
    // === NAVIGATE TO OFFERS PAGE ===
    cy.get("li:nth-child(2) span.truncate").click();
    cy.wait(12000);
    
    // === CLICK CREATE OFFER BUTTON ===
    cy.get("#create-offer", { timeout: 10000 }).should("be.visible").click();
    cy.wait(5000);
    
    // === OFFER 1: 20% Off All Menu Items ===
    
    cy.get('input[placeholder="e.g. 20% Off All Menu Items"]').type(
      "20% Off All Menu Items"
    );
    
    cy.get('input[placeholder="Brief description (max 500 chars)"]').type(
      "Enjoy 20% off your entire meal"
    );
    
    cy.get('textarea[placeholder="Full offer description"]').type(
      "Valid on dine-in and takeout orders. Show offer at time of purchase."
    );
    
    // === SELECT CATEGORY (using name attribute) ===
    cy.get('select[name="category"]').select(
      "Food & Dining"
    );
    
    // === SELECT OFFER TYPE (using name attribute) ===
    cy.get('select[name="offerType"]').select("PERCENTAGE");
    cy.get('select[name="redemptionType"]').select("In-Store QR Code");
    cy.get('input[placeholder="e.g. 5.00"]').type("20");
    cy.get('input[placeholder="Maximum discount amount"]').type("50");
    cy.get('input[placeholder="e.g. 20"]').type("20");
    cy.get('input[placeholder="Minimum order amount"]').type("100");  // ✅ Changed from 0 to 100
    cy.get('input[placeholder="Unlimited if empty"]').type("10");    
    // === REDEMPTION DETAILS FOR OFFER 1 ===
    cy.get('input[type="datetime-local"]').first().type("2026-07-15T00:00");
    cy.get('input[type="datetime-local"]').eq(1).type("2026-12-31T23:59");
    cy.get('textarea[placeholder="Instructions for redeeming this offer"]').type(
      "Show offer at time of purchase."
    );
    cy.get('textarea[placeholder="Terms and conditions"]').type(
      "Max discount $50. Not valid on holidays."
    );
    
    // === SELECT REDEMPTION TYPE (using label/context) ===

    
    cy.get("button[type='submit']").click();
    cy.wait(15000);
    
    // === OFFER 2: 15% Off Electronics ===
    cy.get("#create-offer", { timeout: 10000 }).should("be.visible").click();
    cy.wait(5000);
    
    
    
    cy.get('input[placeholder="e.g. 20% Off All Menu Items"]').type(
      "15% Off Electronics"
    );
    cy.get('input[placeholder="Brief description (max 500 chars)"]').type(
      "Shop online and save 15% on all electronics"
    );
    cy.get('textarea[placeholder="Full offer description"]').type(
      "Apply the code at checkout on our website. Valid on all electronics and accessories."
    );
    
    // === SELECT CATEGORY ===
    cy.get('select[name="category"]').select(
      "913a1d27-7bba-4a5c-908e-135b1849c095"
    );
    
    // === SELECT OFFER TYPE ===
    cy.get('select[name="offerType"]').select("PERCENTAGE");
    
    cy.get('input[placeholder="e.g. 5.00"]').type("15");
    cy.get('input[placeholder="Maximum discount amount"]').type("50");
    cy.get('input[placeholder="e.g. 20"]').type("15");
    cy.get('input[placeholder="Minimum order amount"]').type("0");
    cy.get('input[placeholder="Leave empty for unlimited"]').type("10");
    cy.get("button.bg-primary").click();
    cy.wait(3000);
    
    cy.get('input[type="datetime-local"]').first().type("2026-07-01T00:00");
    cy.get('input[type="datetime-local"]').eq(1).type("2026-10-31T23:59");
    cy.get('textarea[placeholder="Instructions for redeeming this offer"]').type(
      "Apply the code at checkout on our website."
    );
    cy.get('textarea[placeholder="Terms and conditions"]').type(
      "Code is single-use per employee. Cannot be combined with other codes."
    );
    
    // === SELECT REDEMPTION TYPE ===
    cy.get("select").contains("ONLINE_CODE").select("ONLINE_CODE");
    
    // === ONLINE CODE specific field ===
    cy.get('input[placeholder="https://example.com/booking"]').type(
      "https://techgadgets.com/shop/electronics"
    );
    
    cy.get("button.bg-primary").click();
    cy.wait(15000);
    
    // === OFFER 3: Free Trial Session ===
    cy.get("#create-offer", { timeout: 10000 }).should("be.visible").click();
    cy.wait(5000);
    
    cy.get('textarea[placeholder*="replacing your current offer"]', {
      timeout: 10000,
    })
      .should("be.visible")
      .click()
      .clear()
      .type("testing");
    
    cy.get('input[placeholder="e.g. 20% Off All Menu Items"]').type(
      "Free Trial Session — Book Online"
    );
    cy.get('input[placeholder="Brief description (max 500 chars)"]').type(
      "Book a complimentary 1-hour personal training session"
    );
    cy.get('textarea[placeholder="Full offer description"]').type(
      "New members get a free personal training session. Book online using the link below."
    );
    
    // === SELECT CATEGORY ===
    cy.get('select[name="category"]').select(
      "913a1d27-7bba-4a5c-908e-135b1849c095"
    );
    
    // === SELECT OFFER TYPE ===
    cy.get('select[name="offerType"]').select("FLAT");
    
    cy.get('input[placeholder="e.g. 5.00"]').type("0");
    cy.get('input[placeholder="e.g. 20"]').type("0");
    cy.get('input[placeholder="Minimum order amount"]').type("0");
    cy.get('input[placeholder="Leave empty for unlimited"]').type("10");
    cy.get("button.bg-primary").click();
    cy.wait(3000);
    
    cy.get('input[type="datetime-local"]').first().type("2026-07-01T00:00");
    cy.get('input[type="datetime-local"]').eq(1).type("2026-12-31T23:59");
    cy.get('textarea[placeholder="Instructions for redeeming this offer"]').type(
      "Book online using the link below."
    );
    cy.get('textarea[placeholder="Terms and conditions"]').type(
      "One session per employee. Must book within the offer period."
    );
    
    // === SELECT REDEMPTION TYPE ===
    cy.get("select").contains("BOOKING_LINK").select("BOOKING_LINK");
    
    // === BOOKING LINK specific field ===
    cy.get('input[placeholder="https://example.com/booking"]').type(
      "https://fitzone.com/book-trial"
    );
    
    cy.get("button.bg-primary").click();
    cy.wait(15000);
    
    // === SWITCH TO EMPLOYEE ACCOUNT ===
    cy.get("a.justify-start").click();
    cy.get('[name="email"]').click().clear().type("bikenwebocto@gmail.com");
    cy.get('[name="password"]').click().type("biken@123");
    cy.get("#auth-sign-in button.c-bOcPnF").click();
    cy.wait(15000);
  });
});