describe('template spec', () => {
  it('passes', () => {
    cy.visit('http://localhost:3000/login')
    cy.get('[name="email"]').click();
    cy.get('[name="email"]').type('bibek62020@adsprite.com');
    cy.get('[name="password"]').type('bibek@123{enter}');
    cy.wait(15000);
    
  })
})