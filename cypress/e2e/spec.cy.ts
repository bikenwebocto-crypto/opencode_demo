describe('template spec', () => {
  it('passes', () => {
    cy.visit('http://localhost:3000/login')
    cy.get('[name="email"]').click();
    cy.get('[name="email"]').type('bikenwebocto@gmail.com');
    cy.get('[name="password"]').type('biken@123');
    cy.get('#auth-sign-in button.c-bOcPnF').click();
    cy.wait(15000);
    cy.get('a.inline-flex').click();
    cy.get('[name="email"]').click();
    cy.get('[name="email"]').type('bibek62020@adsprite.com');
    cy.get('[name="password"]').click();
    cy.get('[name="password"]').type('bibek@123');
   
  })
});

it('test', function() {
  cy.visit('localhost:3000/login')
  
  cy.get('[name="email"]').click();
  cy.get('[name="email"]').type('bibek62020@adsprite.com');
  cy.get('[name="password"]').click();
  cy.get('[name="password"]').click();
  cy.get('[name="password"]').type('bibek@123');
  cy.get('#auth-sign-in button.c-bOcPnF').click();
  cy.wait(15000);
  cy.get('li:nth-child(2) span.truncate').click();
  cy.wait(10000);
  cy.get('button.inline-flex').click();
  cy.get('textarea[placeholder="Why are you replacing your current offer? (shown to admins during review)"]').click();
  cy.get('textarea[placeholder="Why are you replacing your current offer? (shown to admins during review)"]').type('testing');
  cy.get('input[placeholder="e.g. 20% Off All Menu Items"]').type('testing offer');
  cy.get('input[placeholder="Brief description (max 500 chars)"]').type('make the offer');
  cy.get('textarea[placeholder="Full offer description"]').type('No discription not avaliable');
  cy.get('div:nth-child(4) select.border').select('913a1d27-7bba-4a5c-908e-135b1849c095');
  cy.get('div:nth-child(1) > select.border').select('PERCENTAGE');
  cy.get('input[placeholder="e.g. 5.00"]').type('20');
  cy.get('input[placeholder="Maximum discount amount"]').type('20');
  cy.get('input[placeholder="e.g. 20"]').type('20');
  cy.get('input[placeholder="Minimum order amount"]').type('1000');
  cy.get('input[placeholder="Leave empty for unlimited"]').type('10');
  cy.get('button.bg-primary').click();
  cy.get('input[type="datetime-local"][value=""]').click();
  cy.get('main.flex-1').click();
  cy.get('textarea[placeholder="Instructions for redeeming this offer"]').click();
  cy.get('textarea[placeholder="Instructions for redeeming this offer"]').type('NO real offer is there');
  cy.get('textarea[placeholder="Terms and conditions"]').type('No term conditions is  there');
  cy.get('textarea.min-h-\\[60px\\]').type('NA');
  cy.get('button.bg-primary').click();
  cy.wait(15000);
  
  cy.get('a.justify-start').click();
  cy.get('[name="email"]').click();
  cy.get('[name="email"]').clear();
  cy.get('[name="email"]').type('bikenwebocto@gmail.com');
  cy.get('[name="password"]').click();
  cy.get('[name="password"]').click();
  cy.get('[name="password"]').type('biken@123');
  cy.get('#auth-sign-in button.c-bOcPnF').click();
  cy.wait(15000);
});