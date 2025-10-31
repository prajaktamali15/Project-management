<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple E-commerce Website</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>My E-commerce Store</h1>
        <div class="cart">
            <a href="cart.php">Cart (<span id="cart-count">0</span>)</a>
        </div>
    </header>

    <main>
        <div class="products">
            <?php
            include 'db.php';
            $sql = "SELECT * FROM products";
            $result = $conn->query($sql);

            if ($result->num_rows > 0) {
                while ($row = $result->fetch_assoc()) {
                    echo "<div class='product'>";
                    echo "<img src='" . $row['image'] . "' alt='" . $row['name'] . "'>";
                    echo "<h2>" . $row['name'] . "</h2>";
                    echo "<p>$" . $row['price'] . "</p>";
                    echo "<p>" . $row['description'] . "</p>";
                    echo "<button onclick='addToCart(" . $row['id'] . ")'>Add to Cart</button>";
                    echo "</div>";
                }
            } else {
                echo "No products found.";
            }

            $conn->close();
            ?>
        </div>
    </main>

    <script src="scripts.js"></script>
</body>
</html>
