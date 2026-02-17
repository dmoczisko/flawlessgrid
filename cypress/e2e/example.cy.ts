describe('GameGrid', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/games', { fixture: 'games.json' }).as('getGames')
    cy.visit('/')
    cy.wait('@getGames')
  })

  it('renders 9 game cells after loading', () => {
    cy.get('.grid-cell').should('have.length', 9)
  })

  it('shows the grid number and incorrect guess counter', () => {
    cy.get('.grid-id').should('contain', 'Grid #')
    cy.get('.guess-counter').first().should('contain', 'Incorrect guesses: 0 / 5')
  })

  it('opens the guess modal when clicking an unguessed cell', () => {
    cy.get('.grid-cell').first().click()
    cy.get('.modal').should('be.visible')
    cy.get('.search-input').should('be.focused')
  })

  it('closes the modal when clicking the close button', () => {
    cy.get('.grid-cell').first().click()
    cy.get('.modal').should('be.visible')
    cy.get('.close-btn').first().click()
    cy.get('.modal').should('not.exist')
  })
})
